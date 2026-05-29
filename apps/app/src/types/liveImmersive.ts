export type LiveUxState =
  | 'conversation'
  | 'entering-live'
  | 'focus-video'
  | 'focus-chat'
  | 'focus-presentation'
  | 'media-share'
  | 'participant-promoted'
  | 'message-drawer-open';

export interface LiveParticipant {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
  isHost?: boolean;
  isOnline?: boolean;
}

export interface LiveSlideElement {
  id: string;
  type: 'title' | 'paragraph' | 'image' | 'quote' | 'badge' | 'concept';
  content?: string;
  src?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  animation?: 'fade' | 'fade-up' | 'slide' | 'spotlight';
}

export interface LiveSlide {
  id: string;
  title: string;
  styleVariant: string;
  layoutType: string;
  backgroundMode: string;
  elements: LiveSlideElement[];
}

export interface LiveRoomSession {
  id: string;
  conversationId: string;
  title: string;
  hostUserId: string;
  status: 'pending' | 'active' | 'ended';
  startedAt?: string;
  endedAt?: string;
  roomName?: string;
}
