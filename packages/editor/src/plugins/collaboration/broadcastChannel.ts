import type { Doc } from '../../editor/model/types';
import type { CollaborationTransport, DocUpdate } from './index';

type Message =
  | { type: 'hello'; from: string }
  | { type: 'snapshot'; to: string; doc: Doc }
  | { type: 'update'; from: string; update: DocUpdate };

/**
 * Syncs content between tabs of the same browser. A tab that joins adopts the
 * document of a tab already open. Handy for demos and local testing; use a
 * network transport to collaborate across devices.
 */
export function broadcastChannelSync({ channel: name = 'notomate-editor-sync' } = {}): CollaborationTransport {
  return (conn) => {
    if (typeof BroadcastChannel === 'undefined') return () => {};
    const id = Math.random().toString(36).slice(2, 10);
    const channel = new BroadcastChannel(name);
    const send = (msg: Message) => channel.postMessage(msg);
    let joined = false;

    channel.onmessage = (e: MessageEvent<Message>) => {
      const msg = e.data;
      // Only a tab holding the shared document answers, so joiners never adopt each other's.
      if (msg.type === 'hello') {
        if (joined) send({ type: 'snapshot', to: msg.from, doc: conn.getDoc() });
      } else if (msg.type === 'snapshot' && msg.to === id && !joined) {
        joined = true;
        conn.loadDoc(msg.doc);
      } else if (msg.type === 'update' && msg.from !== id) conn.applyUpdate(msg.update);
    };

    const off = conn.onLocalUpdate((update) => send({ type: 'update', from: id, update }));
    send({ type: 'hello', from: id });
    // Nobody answered: this tab's document is the shared one.
    const alone = setTimeout(() => (joined = true), 500);

    return () => {
      clearTimeout(alone);
      off();
      channel.close();
    };
  };
}
