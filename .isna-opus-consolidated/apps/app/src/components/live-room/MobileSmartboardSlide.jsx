import React from 'react';

/**
 * Slide Smartboard mobile (template « authority ») : le contenu respecte
 * un dégagement pour la zone vidéo prof (coin supérieur droit), sans chevauchement.
 */
export function MobileSmartboardSlide({ slide }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-white text-slate-950 shadow-2xl">
      {/* HEADER LIVE */}
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            {slide.header.live && (
              <span className="rounded-lg bg-rose-500 px-2 py-1 text-[11px] font-bold text-white">LIVE</span>
            )}

            <div>
              <div className="text-[14px] font-bold">🎓 {slide.header.subject}</div>
              <div className="mt-1 text-[11px] text-slate-500">{slide.header.chapter}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-semibold">
            {slide.header.currentSlide} / {slide.header.totalSlides}
          </div>
        </div>

        <div className="mt-4 h-[3px] w-full rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{
              width: `${Math.min(100, Math.max(0, (slide.header.currentSlide / Math.max(1, slide.header.totalSlides)) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* ZONE VIDÉO PROF — lockedZone (aucun contenu pédagogique ne doit s’y superposer) */}
      <div className="absolute right-5 top-[118px] z-20 h-[150px] w-[132px] rounded-2xl bg-slate-900 shadow-xl ring-2 ring-white">
        <div className="flex h-full w-full items-center justify-center text-center text-xs text-white/80">Flux vidéo prof</div>

        <div className="absolute bottom-0 left-0 right-0 rounded-b-2xl bg-black/50 px-2 py-1 text-[10px] text-white">
          Prof. Manikongo 🔊
        </div>
      </div>

      {/* CONTENU SMARTBOARD */}
      <div className="px-7 pt-14">
        <div className="pr-[145px]">
          <div className="mb-3 inline-flex rounded-lg bg-blue-50 px-3 py-1 text-[12px] font-bold text-blue-600">
            {slide.title.badge}
          </div>

          <h1 className="max-w-[210px] text-[34px] font-black leading-[0.98] tracking-tight">{slide.title.text}</h1>

          <div className="mt-4 h-1 w-16 rounded-full bg-blue-500" />
        </div>

        <div className="mt-8 flex items-center gap-4 rounded-xl bg-blue-50 px-4 py-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-500 text-2xl">
            {slide.keyIdea.icon}
          </div>

          <div>
            <div className="text-[14px] font-black text-blue-600">{slide.keyIdea.title}</div>
            <div className="mt-1 text-[15px] leading-snug text-slate-800">{slide.keyIdea.text}</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 text-[14px] font-black text-blue-600">{slide.valueBlock.title}</div>

          <div className="whitespace-pre-line rounded-xl border border-blue-100 px-4 py-5 text-center text-[25px] font-black leading-snug text-blue-600">
            {slide.valueBlock.value}
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-emerald-50 px-5 py-5">
          <div className="mb-3 text-[14px] font-black text-emerald-700">{slide.rememberBlock.title}</div>

          <div className="space-y-3">
            {slide.rememberBlock.points.map((point, index) => (
              <div key={index} className="flex gap-3 text-[14px] leading-snug">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                  ✓
                </span>
                <span>{point}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 text-center">
            <div className="flex items-center justify-center gap-8 text-5xl">
              <span>{slide.rememberBlock.diagram.left}</span>
              <span className="text-4xl text-blue-500">{slide.rememberBlock.diagram.arrow}</span>
              <span>{slide.rememberBlock.diagram.right}</span>
            </div>

            <div className="mt-3 whitespace-pre-line text-[14px] leading-snug">{slide.rememberBlock.diagram.caption}</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 px-5">
        <div className="flex items-end justify-between">
          <button type="button" className="flex flex-col items-center gap-1 text-[11px] text-slate-700">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-2xl text-white">☰</span>
            Menu
          </button>

          <div className="pb-3 text-center">
            <div className="mb-2 flex justify-center gap-2">
              {Array.from({ length: slide.header.totalSlides }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-5 rounded-full ${i + 1 === slide.header.currentSlide ? 'bg-blue-500' : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <div className="text-[12px] text-slate-600">Swipe haut ou bas pour changer d’écran</div>
          </div>

          <button type="button" className="flex flex-col items-center gap-1 text-[11px] text-slate-700">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-xl text-white">✦</span>
            Longia IA
          </button>
        </div>
      </div>
    </div>
  );
}
