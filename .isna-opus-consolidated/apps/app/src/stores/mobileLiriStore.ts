import { create } from 'zustand';

export type MobileOverlay =
  | 'none'
  | 'members'
  | 'smartboard-full'
  | 'settings'
  | 'member-actions'
  | 'private-chat'
  | 'whisper'
  | 'profile'
  | 'exit-confirm';

export type GestureDirection = 'up' | 'down' | 'left' | 'right';

export type SelectedMember = {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
  isHost?: boolean;
  /** Texte sous le badge présence (ex. récence) */
  lastActiveLabel?: string;
  /** Ville / pays si connu */
  locationLabel?: string;
};

type MobileLiriStore = {
  activeOverlay: MobileOverlay;
  selectedMember: SelectedMember | null;
  smartboardFull: boolean;
  setOverlay: (overlay: MobileOverlay) => void;
  closeOverlay: () => void;
  openMemberActions: (member: SelectedMember) => void;
  openPrivateChat: (member: SelectedMember) => void;
  openProfile: (member: SelectedMember) => void;
  clearSelectedMember: () => void;
  setSmartboardFull: (v: boolean) => void;
  /** Remplace l’overlay par la confirmation de sortie (live Arena / messagerie). */
  openExitConfirm: () => void;
  /** Chat forum de la session (sans membre ciblé). */
  openLiveForumChat: () => void;
  /** Chuchotement 1:1 (live Arena / messagerie avec session). */
  openWhisperChat: (member: SelectedMember) => void;
};

export const useMobileLiriStore = create<MobileLiriStore>((set) => ({
  activeOverlay: 'none',
  selectedMember: null,
  smartboardFull: false,
  setOverlay: (overlay) =>
    set({
      activeOverlay: overlay,
      smartboardFull: overlay === 'smartboard-full',
    }),
  closeOverlay: () => set({ activeOverlay: 'none', smartboardFull: false }),
  openMemberActions: (member) =>
    set({ selectedMember: member, activeOverlay: 'member-actions' }),
  openPrivateChat: (member) =>
    set({ selectedMember: member, activeOverlay: 'private-chat' }),
  openProfile: (member) =>
    set({ selectedMember: member, activeOverlay: 'profile' }),
  clearSelectedMember: () => set({ selectedMember: null }),
  setSmartboardFull: (v) => set({ smartboardFull: v }),
  openExitConfirm: () => set({ activeOverlay: 'exit-confirm', smartboardFull: false }),
  openLiveForumChat: () =>
    set({
      selectedMember: {
        id: '__live_forum__',
        name: 'Chat du live',
        isHost: false,
      },
      activeOverlay: 'private-chat',
    }),
  openWhisperChat: (member) => set({ selectedMember: member, activeOverlay: 'whisper' }),
}));

export function mapGestureToOverlay(direction: GestureDirection): MobileOverlay | 'exit' | null {
  switch (direction) {
    case 'up':
      return 'members';
    case 'down':
      return 'smartboard-full';
    case 'right':
      return 'settings';
    case 'left':
      return 'exit';
    default:
      return null;
  }
}
