import { create } from 'zustand';
import type { PresenceState } from '../../editor/events';

export interface PeerInfo {
  id: string;
  name: string;
  /** Any CSS color; used for the outline and name tag. */
  color: string;
}

export interface Peer extends PeerInfo, PresenceState {
  lastSeen: number;
}

interface PresenceStore {
  me: PeerInfo | null;
  peers: Record<string, Peer>;
}

/** This user and the collaborators currently known, for building custom presence UI. */
export const usePresence = create<PresenceStore>()(() => ({ me: null, peers: {} }));

export function setMe(me: PeerInfo | null) {
  usePresence.setState({ me });
}

/** Add or update a collaborator. */
export function upsertPeer(peer: PeerInfo & Partial<PresenceState>) {
  const peers = usePresence.getState().peers;
  const prev = peers[peer.id];
  usePresence.setState({
    peers: {
      ...peers,
      [peer.id]: {
        ...prev,
        ...peer,
        // An explicit null means "left the block", so test presence of the key, not its value.
        blockId: 'blockId' in peer ? (peer.blockId ?? null) : (prev?.blockId ?? null),
        selection: peer.selection ?? prev?.selection ?? [],
        lastSeen: Date.now(),
      },
    },
  });
}

export function removePeer(id: string) {
  const { [id]: _gone, ...rest } = usePresence.getState().peers;
  usePresence.setState({ peers: rest });
}

export function clearPeers() {
  usePresence.setState({ peers: {} });
}
