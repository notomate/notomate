import type { EditorPlugin } from '../../editor/plugins';
import type { DocChange } from '../../editor/events';
import type { Doc } from '../../editor/model/types';
import type { RemoteUpdate } from '../../editor/model/store';
import { setDocument } from '../../editor/model/store';

export { broadcastChannelSync } from './broadcastChannel';

/** A set of block-level changes, as sent between collaborators. */
export type DocUpdate = RemoteUpdate;

/** Handed to a transport: local updates out, collaborators' updates in. */
export interface CollaborationConnection {
  getDoc(): Doc;
  /** Replace the local document with the shared one, e.g. a snapshot received on join. */
  loadDoc(doc: Doc): void;
  /**
   * Apply a collaborator's update. Deliver each of their changes in one call: a block
   * that arrives without the list that references it looks orphaned and is re-attached.
   */
  applyUpdate(update: DocUpdate): void;
  /** Called with each local change (edits, undo, redo), never with applied remote ones. */
  onLocalUpdate(fn: (update: DocUpdate) => void): () => void;
}

/** Connects to your network. Returns a disconnect function. */
export type CollaborationTransport = (conn: CollaborationConnection) => () => void;

export interface CollaborationOptions {
  transport: CollaborationTransport;
}

/** The blocks a change touched, as an update a collaborator can apply. */
export function updateFromChange(c: DocChange): DocUpdate {
  const update: DocUpdate = {};
  const upsert = [...c.added, ...c.updated].map((id) => c.next.blocks[id]);
  if (upsert.length) update.upsert = upsert;
  if (c.removed.length) update.remove = c.removed;
  if (c.orderChanged) update.rootIds = c.next.rootIds;
  if (c.titleChanged) update.title = c.next.title;
  return update;
}

/**
 * Sync document content between collaborators. Conflicts resolve per block, last
 * writer wins: two people typing in the same block at once overwrite each other.
 */
export function collaboration({ transport }: CollaborationOptions): EditorPlugin {
  return {
    name: 'collaboration',
    setup(editor) {
      return transport({
        getDoc: editor.getDoc,
        loadDoc: setDocument,
        applyUpdate: editor.applyRemote,
        onLocalUpdate: (fn) => editor.on('change', (c) => c.origin !== 'remote' && fn(updateFromChange(c))),
      });
    },
  };
}
