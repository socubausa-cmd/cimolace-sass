import { describe, expect, it } from 'vitest';
import { Track } from 'livekit-client';
import {
  describeLiveKitMediaError,
  pickCameraPublicationForPreview,
} from '@/lib/liveKitParticipantVideo';

describe('describeLiveKitMediaError', () => {
  it('mappe NotAllowedError', () => {
    expect(describeLiveKitMediaError({ name: 'NotAllowedError', message: '' })).toContain(
      'Accès refusé',
    );
  });

  it('mappe OverconstrainedError', () => {
    expect(describeLiveKitMediaError({ name: 'OverconstrainedError', message: '' })).toContain(
      'résolution',
    );
  });

  it('retombe sur le message brut', () => {
    expect(describeLiveKitMediaError({ name: 'Error', message: 'foo' })).toBe('foo');
  });
});

describe('pickCameraPublicationForPreview', () => {
  it('préfère une piste caméra active à une publication muette du getter', () => {
    const good = {
      source: Track.Source.Camera,
      isMuted: false,
      track: { attach: () => {}, detach: () => {} },
    };
    const stale = {
      source: Track.Source.Camera,
      isMuted: true,
      track: null,
    };
    const participant = {
      videoTrackPublications: new Map([['a', good], ['b', stale]]),
      getTrackPublication: () => stale,
    };
    expect(pickCameraPublicationForPreview(participant)).toBe(good);
  });

  it('retourne null sans participant', () => {
    expect(pickCameraPublicationForPreview(null)).toBeNull();
  });
});
