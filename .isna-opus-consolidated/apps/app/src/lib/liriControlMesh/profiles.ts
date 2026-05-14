import type { PermissionId, Permissions } from './permissions';
import { emptyPermissions, mergePermissions } from './permissions';

export type ControlProfileId =
  | 'host_primary'
  | 'cohost'
  | 'admin_live'
  | 'admin_webinar'
  | 'moderator'
  | 'presenter'
  | 'music_lead'
  | 'tech_audio'
  | 'tech_visual'
  | 'guest_speaker'
  | 'debater'
  | 'liturgy_assistant';

export type ControlProfile = {
  id: ControlProfileId;
  labelFr: string;
  labelEn: string;
  /** Permissions activées par défaut pour ce profil. */
  grants: Partial<Permissions>;
};

const allTrue = (): Partial<Permissions> => {
  const o: Partial<Permissions> = {};
  const keys: PermissionId[] = [
    'view_smartboard',
    'manipulate_active_scene',
    'load_personal_scene',
    'modify_existing_scene',
    'open_smartboard_composer',
    'use_progressive_mode',
    'share_images',
    'share_slides',
    'share_web',
    'share_embed',
    'share_video',
    'share_audio',
    'manage_music',
    'toggle_remote_mics',
    'toggle_remote_cameras',
    'stage_raise_lower',
    'give_floor',
    'manage_waiting_room',
    'manage_hands',
    'send_announcements',
    'pass_control',
    'request_control_visible',
    'grant_control',
    'revoke_control',
    'set_control_duration',
    'split_smartboard',
    'realtime_coedit',
    'copresentation',
    'dual_event_visible',
  ];
  for (const k of keys) o[k] = true;
  return o;
};

export const CONTROL_PROFILES: ControlProfile[] = [
  { id: 'host_primary', labelFr: 'Hôte principal', labelEn: 'Primary host', grants: allTrue() },
  {
    id: 'cohost',
    labelFr: 'Co-hôte',
    labelEn: 'Co-host',
    grants: mergePermissions(emptyPermissions(), {
      ...allTrue(),
      modify_existing_scene: false,
      revoke_control: false,
    }),
  },
  {
    id: 'admin_live',
    labelFr: 'Admin live',
    labelEn: 'Live admin',
    grants: mergePermissions(emptyPermissions(), {
      view_smartboard: true,
      manage_waiting_room: true,
      manage_hands: true,
      toggle_remote_mics: true,
      toggle_remote_cameras: true,
      stage_raise_lower: true,
      give_floor: true,
      send_announcements: true,
      grant_control: true,
      revoke_control: true,
      set_control_duration: true,
      pass_control: true,
    }),
  },
  {
    id: 'admin_webinar',
    labelFr: 'Admin webinaire',
    labelEn: 'Webinar admin',
    grants: mergePermissions(emptyPermissions(), {
      view_smartboard: true,
      manage_waiting_room: true,
      grant_control: true,
      revoke_control: true,
      send_announcements: true,
      toggle_remote_mics: true,
    }),
  },
  {
    id: 'moderator',
    labelFr: 'Modérateur',
    labelEn: 'Moderator',
    grants: mergePermissions(emptyPermissions(), {
      view_smartboard: true,
      manage_hands: true,
      give_floor: true,
      send_announcements: true,
      request_control_visible: true,
    }),
  },
  {
    id: 'presenter',
    labelFr: 'Présentateur',
    labelEn: 'Presenter',
    grants: mergePermissions(emptyPermissions(), {
      view_smartboard: true,
      manipulate_active_scene: true,
      share_slides: true,
      share_web: true,
      share_embed: true,
      share_video: true,
      use_progressive_mode: true,
      open_smartboard_composer: true,
    }),
  },
  {
    id: 'music_lead',
    labelFr: 'Chantre',
    labelEn: 'Music lead',
    grants: mergePermissions(emptyPermissions(), {
      view_smartboard: true,
      manipulate_active_scene: true,
      share_audio: true,
      manage_music: true,
      share_images: true,
    }),
  },
  {
    id: 'tech_audio',
    labelFr: 'Technicien audio',
    labelEn: 'Audio tech',
    grants: mergePermissions(emptyPermissions(), {
      view_smartboard: true,
      share_audio: true,
      manage_music: true,
      toggle_remote_mics: true,
    }),
  },
  {
    id: 'tech_visual',
    labelFr: 'Technicien visuel',
    labelEn: 'Visual tech',
    grants: mergePermissions(emptyPermissions(), {
      view_smartboard: true,
      share_video: true,
      share_images: true,
      share_slides: true,
      split_smartboard: true,
    }),
  },
  {
    id: 'guest_speaker',
    labelFr: 'Invité intervenant',
    labelEn: 'Guest speaker',
    grants: mergePermissions(emptyPermissions(), {
      view_smartboard: true,
      load_personal_scene: true,
      share_images: true,
      share_slides: true,
      request_control_visible: true,
    }),
  },
  {
    id: 'debater',
    labelFr: 'Débatteur',
    labelEn: 'Debater',
    grants: mergePermissions(emptyPermissions(), {
      view_smartboard: true,
      load_personal_scene: true,
      manipulate_active_scene: true,
      split_smartboard: true,
      copresentation: true,
    }),
  },
  {
    id: 'liturgy_assistant',
    labelFr: 'Diacre / assistant culte',
    labelEn: 'Liturgy assistant',
    grants: mergePermissions(emptyPermissions(), {
      view_smartboard: true,
      send_announcements: true,
      share_images: true,
      share_web: true,
      manage_hands: true,
    }),
  },
];

export function getProfile(id: ControlProfileId): ControlProfile | undefined {
  return CONTROL_PROFILES.find((p) => p.id === id);
}

export function permissionsForProfile(id: ControlProfileId): Permissions {
  const p = getProfile(id);
  if (!p) return emptyPermissions();
  return mergePermissions(emptyPermissions(), p.grants);
}
