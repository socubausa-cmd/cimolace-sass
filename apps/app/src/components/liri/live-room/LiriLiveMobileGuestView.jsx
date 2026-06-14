import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MOBILE_LIVE_AUTHORITY_WIDTH } from '@/lib/smartboardDesignCanvas';
import { generateMobileSmartboardSlide } from '@/lib/mobile-smartboard-generator';
import { MobileSmartboardSlide } from '@/components/liri/live-room/MobileSmartboardSlide';

/** Vue invité LiriLive mobile (Smartboard prioritaire, chrome minimal). */
export default function LiriLiveMobileGuestView({ lesson, className }) {
  const slide = useMemo(
    () =>
      generateMobileSmartboardSlide({
        subject: lesson?.subject,
        chapter: lesson?.chapter,
        title: lesson?.title,
        currentSlide: lesson?.currentSlide,
        totalSlides: lesson?.totalSlides,
        keyText: lesson?.keyText,
        value: lesson?.value,
        points: lesson?.points,
      }),
    [lesson],
  );

  return (
    <main className={cn('min-h-screen bg-black px-3 py-4', className)}>
      <div
        className="mx-auto h-[calc(100vh-32px)] max-h-[920px] w-full"
        style={{ maxWidth: MOBILE_LIVE_AUTHORITY_WIDTH }}
      >
        <MobileSmartboardSlide slide={slide} />
      </div>
    </main>
  );
}
