import * as Y from 'yjs'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { sanitizeInline } from '@notomate/editor'
import type {
  Block,
  CollaborationTransport,
  Doc,
  DocUpdate,
  PeerInfo,
  PresenceState,
  PresenceTransport,
} from '@notomate/editor'

/** Key type of `Transaction.changed`. */
type YType = Parameters<Y.Transaction['changed']['get']>[0]

/** Marks our own Y transactions so they are not applied back to the editor. */
const LOCAL = Symbol('note-editor')

const isIdList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/**
 * A block as received from the room, made safe to render. Anyone with write access to
 * the room can put arbitrary values there, and block HTML goes into the page as-is.
 */
export function cleanBlock(id: string, raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Partial<Block>
  if (typeof b.type !== 'string') return null
  return {
    id,
    type: b.type,
    html: typeof b.html === 'string' ? sanitizeInline(b.html) : '',
    props: b.props && typeof b.props === 'object' ? b.props : {},
    children: isIdList(b.children) ? b.children : [],
    parentId: typeof b.parentId === 'string' ? b.parentId : null,
  }
}

/** The editor document held in a note room (`blocks` + `meta.rootIds`). */
export function docFromRoom(yDoc: Y.Doc): Doc {
  const blocks: Record<string, Block> = {}
  yDoc.getMap('blocks').forEach((raw, id) => {
    const b = cleanBlock(id, raw)
    if (b) blocks[id] = b
  })
  const rootIds = yDoc.getMap('meta').get('rootIds')
  return { title: '', blocks, rootIds: isIdList(rootIds) ? rootIds.filter((id) => blocks[id]) : [] }
}

/**
 * Sync editor blocks through the note's Y.Doc. The title is not part of it: the page
 * header edits `meta.title` directly.
 */
export function yjsSync(yDoc: Y.Doc): CollaborationTransport {
  return (conn) => {
    const blocks = yDoc.getMap('blocks')
    const meta = yDoc.getMap('meta')

    const offLocal = conn.onLocalUpdate((u) => {
      yDoc.transact(() => {
        for (const id of u.remove ?? []) blocks.delete(id)
        for (const b of u.upsert ?? []) blocks.set(b.id, b)
        if (u.rootIds) meta.set('rootIds', u.rootIds)
      }, LOCAL)
    })

    // One remote transaction = one update, so a new block always arrives together
    // with the list that references it.
    const onTransaction = (tr: Y.Transaction) => {
      if (tr.origin === LOCAL) return
      const update: DocUpdate = {}
      for (const id of tr.changed.get(blocks as unknown as YType) ?? []) {
        if (id === null) continue
        const b = blocks.has(id) ? cleanBlock(id, blocks.get(id)) : null
        if (b) (update.upsert ??= []).push(b)
        else (update.remove ??= []).push(id)
      }
      if (tr.changed.get(meta as unknown as YType)?.has('rootIds')) {
        const rootIds = meta.get('rootIds')
        update.rootIds = isIdList(rootIds) ? rootIds : []
      }
      if (update.upsert || update.remove || update.rootIds) conn.applyUpdate(update)
    }
    yDoc.on('afterTransaction', onTransaction)
    // Catch up on anything that arrived between the first render and this setup.
    conn.loadDoc(docFromRoom(yDoc))

    return () => {
      offLocal()
      yDoc.off('afterTransaction', onTransaction)
    }
  }
}

interface AwarenessPresence extends PresenceState {
  peer: PeerInfo
}

/** Share carets and block selections through the room's awareness. */
export function awarenessPresence(provider: HocuspocusProvider): PresenceTransport {
  return (conn) => {
    const awareness = provider.awareness
    if (!awareness) return () => {}
    const publish = () =>
      awareness.setLocalStateField('presence', { peer: conn.me, ...conn.local() } satisfies AwarenessPresence)

    const onChange = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const states = awareness.getStates()
      for (const clientId of [...added, ...updated]) {
        if (clientId === awareness.clientID) continue
        const p = states.get(clientId)?.presence as AwarenessPresence | null | undefined
        if (p?.peer) conn.upsertPeer({ ...p.peer, id: String(clientId), blockId: p.blockId, selection: p.selection })
        else conn.removePeer(String(clientId))
      }
      for (const clientId of removed) conn.removePeer(String(clientId))
    }

    awareness.on('change', onChange)
    const offLocal = conn.onLocalChange(publish)
    publish()
    // Pick up people who were here before us.
    onChange({ added: [...awareness.getStates().keys()], updated: [], removed: [] })

    return () => {
      offLocal()
      awareness.off('change', onChange)
      awareness.setLocalStateField('presence', null)
    }
  }
}

const COLORS = ['#e8590c', '#2f9e44', '#1c7ed6', '#ae3ec9', '#d6336c', '#0c8599', '#f08c00', '#5f3dc4']

/** This tab as a collaborator. The id is the awareness client id, so two tabs of one user both show. */
export function presenceUser(provider: HocuspocusProvider, user: { id: string; name: string } | null): PeerInfo {
  const key = user?.id ?? 'guest'
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return {
    id: String(provider.awareness?.clientID ?? key),
    name: user?.name ?? 'Guest',
    color: COLORS[Math.abs(hash) % COLORS.length],
  }
}
