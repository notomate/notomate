import type { CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePresence, type Peer } from './store';
import { msg } from '../../editor/messages';

/** Collaborators editing this block (`text`) or holding it in block selection (`selection`). */
function usePeersOn(id: string, mode: 'text' | 'selection'): Peer[] {
  return usePresence(
    useShallow((s) =>
      Object.values(s.peers).filter((p) => (mode === 'text' ? p.blockId === id : p.selection.includes(id))),
    ),
  );
}

/** Coloured outline with name tags; place inside a positioned element. */
function PeerRing({ peers, variant, blockId }: { peers: Peer[]; variant: 'text' | 'selection'; blockId: string }) {
  if (!peers.length) return null;
  // A multi-block selection is labelled once, on its first block.
  const tagged = variant === 'text' ? peers : peers.filter((p) => p.selection[0] === blockId);
  return (
    <div className={`peer-ring ${variant}`} style={{ '--peer': peers[0].color } as CSSProperties} aria-hidden="true">
      <div className="peer-tags">
        {tagged.map((p) => (
          <span key={p.id} className="peer-tag" style={{ background: p.color }}>
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SelectionRing({ blockId }: { blockId: string }) {
  return <PeerRing peers={usePeersOn(blockId, 'selection')} variant="selection" blockId={blockId} />;
}

export function TextRing({ blockId }: { blockId: string }) {
  return <PeerRing peers={usePeersOn(blockId, 'text')} variant="text" blockId={blockId} />;
}

export function PresenceBar() {
  const me = usePresence((s) => s.me);
  const peers = usePresence(useShallow((s) => Object.values(s.peers)));
  if (!me) return null;
  const everyone = [me, ...peers];
  return (
    <div className="ui-layer presence-bar" aria-label={msg().peersOnline(everyone.length)}>
      {everyone.map((p) => (
        <span
          key={p.id}
          className="avatar"
          style={{ background: p.color }}
          title={p.id === me.id ? msg().you(p.name) : p.name}
        >
          {p.name.slice(-1)}
        </span>
      ))}
    </div>
  );
}
