import type { PeerInfo } from './store';
import type { PresenceTransport } from './index';

const HEARTBEAT_MS = 3000;
const TIMEOUT_MS = 10000;

type Message =
  | { type: 'hello' | 'presence'; peer: PeerInfo; blockId: string | null; selection: string[] }
  | { type: 'bye'; id: string };

/**
 * Shares presence between tabs of the same browser. Handy for demos and local testing;
 * use a network transport to collaborate across devices.
 */
export function broadcastChannelTransport({ channel: name = 'notomate-editor-presence' } = {}): PresenceTransport {
  return (conn) => {
    if (typeof BroadcastChannel === 'undefined') return () => {};
    const { me } = conn;
    const channel = new BroadcastChannel(name);
    const post = (type: 'hello' | 'presence') => channel.postMessage({ type, peer: me, ...conn.local() } satisfies Message);

    channel.onmessage = (e: MessageEvent<Message>) => {
      const msg = e.data;
      if (msg.type === 'bye') {
        conn.removePeer(msg.id);
        return;
      }
      if (msg.peer.id === me.id) return;
      conn.upsertPeer({ ...msg.peer, blockId: msg.blockId, selection: msg.selection });
      if (msg.type === 'hello') post('presence');
    };

    const offPresence = conn.onLocalChange(() => post('presence'));
    const heartbeat = setInterval(() => {
      post('presence');
      const now = Date.now();
      for (const p of conn.peers()) if (now - p.lastSeen > TIMEOUT_MS) conn.removePeer(p.id);
    }, HEARTBEAT_MS);
    const bye = () => channel.postMessage({ type: 'bye', id: me.id } satisfies Message);
    window.addEventListener('pagehide', bye);
    post('hello');

    return () => {
      bye();
      offPresence();
      clearInterval(heartbeat);
      window.removeEventListener('pagehide', bye);
      channel.close();
    };
  };
}
