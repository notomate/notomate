import type { EditorPlugin } from '../../editor/plugins';
import type { PresenceState } from '../../editor/events';
import { clearPeers, removePeer, setMe, upsertPeer, usePresence, type Peer, type PeerInfo } from './store';
import { PresenceBar, SelectionRing, TextRing } from './ui';
import { msg } from '../../editor/messages';

export { usePresence } from './store';
export type { Peer, PeerInfo } from './store';
export { broadcastChannelTransport } from './broadcastChannel';

/** Handed to a transport: this user's presence out, collaborators' presence in. */
export interface PresenceConnection {
  me: PeerInfo;
  /** This user's current caret block and block selection. */
  local(): PresenceState;
  /** Called whenever the local presence changes. Returns an unsubscribe function. */
  onLocalChange(fn: (p: PresenceState) => void): () => void;
  /** Report a collaborator (call again with partial state to update). */
  upsertPeer(peer: PeerInfo & Partial<PresenceState>): void;
  removePeer(id: string): void;
  peers(): Peer[];
}

/** Connects to your network (WebSocket, Liveblocks, Yjs awareness…). Returns a disconnect function. */
export type PresenceTransport = (conn: PresenceConnection) => () => void;

export interface PresenceOptions {
  transport: PresenceTransport;
  /** This user. Defaults to a random guest name and color. */
  user?: PeerInfo;
  /** Show the avatar bar. Default true. */
  bar?: boolean;
}

const NAMES = ['Bear', 'Otter', 'Penguin', 'Fox', 'Whale', 'Owl', 'Squirrel', 'Hedgehog'];
const COLORS = ['#e8590c', '#2f9e44', '#1c7ed6', '#ae3ec9', '#d6336c', '#0c8599', '#f08c00', '#5f3dc4'];

function guest(): PeerInfo {
  const n = Math.floor(Math.random() * NAMES.length);
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: `${msg().guest} ${NAMES[n]}`,
    color: COLORS[(n + Math.floor(Math.random() * 3)) % COLORS.length],
  };
}

/** Show collaborators' carets and block selections, and the people on the page. */
export function presence({ transport, user, bar = true }: PresenceOptions): EditorPlugin {
  return {
    name: 'presence',
    setup(editor) {
      // Named here, after the editor installed its messages.
      const me = user ?? guest();
      setMe(me);
      const disconnect = transport({
        me,
        local: editor.localPresence,
        onLocalChange: (fn) => editor.on('presence', fn),
        upsertPeer: (peer) => peer.id !== me.id && upsertPeer(peer),
        removePeer,
        peers: () => Object.values(usePresence.getState().peers),
      });
      return () => {
        disconnect();
        clearPeers();
        setMe(null);
      };
    },
    Overlay: bar ? PresenceBar : undefined,
    decorations: { block: SelectionRing, row: TextRing },
  };
}
