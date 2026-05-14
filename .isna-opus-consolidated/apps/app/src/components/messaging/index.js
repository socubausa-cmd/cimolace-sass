/**
 * Barrel export for all messaging sub-components.
 * Extracted from MessagingPage.jsx (REQ-FE-004).
 */

export { UserAvatar, OnlineDot } from './atoms';
export { ImmersiveMessage } from './ImmersiveMessage';
export { TypingOverlay, EmptyState, NoMessagesState } from './MessageStateViews';
export { ImmersiveComposer } from './ImmersiveComposer';
export { LiveActionDock } from './LiveActionDock';
export { MemberPickerPanel } from './MemberPickerPanel';
export { SearchPanel } from './SearchPanel';
export {
  DeleteMessagePrompt,
  PublicProfilePanel,
  LiveSummaryPanel,
  LiveInvitePrompt,
  LiveAgendaPanel,
  liveDashboardNotifTypeLabel,
} from './LiveSidePanels';
