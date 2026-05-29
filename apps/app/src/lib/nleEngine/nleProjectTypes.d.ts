export type NleTransition =
  | { type: 'cut'; durationSec: number }
  | { type: 'crossfade'; durationSec: number }
  | { type: 'dip_to_black'; durationSec: number };

export type NleClipEffect =
  | { kind: 'color_grade'; payload: Record<string, number> }
  | { kind: 'opacity'; value: number };

export interface NleClip {
  id: string;
  label: string;
  sourceType: string;
  sourceRef: string;
  startOnTimeline: number;
  duration: number;
  trimIn: number;
  trimOut: number;
  opacity: number;
  volume: number;
  effects: NleClipEffect[];
  transitionIn: NleTransition;
  transitionOut: NleTransition;
}

export interface NleTrack {
  id: string;
  type: 'video' | 'audio';
  lane: number;
  name: string;
  muted: boolean;
  locked: boolean;
  solo: boolean;
  clips: NleClip[];
}

export interface NleMarker {
  id: string;
  timeSec: number;
  label: string;
  color?: string;
}

export interface NleProject {
  version: number;
  name: string;
  frameRate: number;
  timebase: string;
  duration: number;
  tracks: NleTrack[];
  markers: NleMarker[];
  master: {
    colorGrade: {
      exposure: number;
      contrast: number;
      saturation: number;
      warmth: number;
    };
  };
  mix: {
    masterVolumeDb: number;
  };
}
