/**
 * LibraryCard — carte individuelle d'un item de la bibliothèque.
 * Affiche : image preview, titre, tags, compatibilité, bouton utiliser.
 */
import React, { useState } from 'react';
import {
  Heart, Download, Zap, ExternalLink,
  Image, Layers, Palette, FileJson, Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_ICON = {
  image: Image,
  vector: Layers,
  lut: Palette,
  template: FileJson,
  project: Archive,
};

const CATEGORY_COLOR = {
  image: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  vector: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  lut: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  template: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20',
  project: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

const COMPAT_COLOR = {
  100: 'text-emerald-400',
  70: 'text-amber-400',
  30: 'text-red-400',
};

export default function LibraryCard({ item, onUse, onLike, onSelect, selected }) {
  const [imgError, setImgError] = useState(false);
  const Icon = CATEGORY_ICON[item.category] ?? Image;
  const categoryStyle = CATEGORY_COLOR[item.category] ?? '';
  const compatColor = COMPAT_COLOR[item.compatibility] ?? 'text-white/40';

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-[#0d1020] transition-all cursor-pointer',
        selected
          ? 'border-[#D4AF37]/50 ring-1 ring-[#D4AF37]/30'
          : 'border-white/8 hover:border-white/20',
      )}
      onClick={() => onSelect?.(item)}
    >
      {/* Preview */}
      <div className="relative aspect-video overflow-hidden bg-[#080a12]">
        {item.preview && !imgError ? (
          <img
            src={item.preview}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className={cn('h-10 w-10', categoryStyle.split(' ')[0] ?? 'text-white/20')} />
          </div>
        )}

        {/* Compatibility badge */}
        <div className={cn('absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold backdrop-blur-sm', compatColor, 'bg-black/50')}>
          {item.compatibility}%
        </div>

        {/* Source badge */}
        {item.source === 'community' && (
          <div className="absolute left-2 top-2 rounded-full bg-[#D4AF37]/20 px-1.5 py-0.5 text-[9px] font-semibold text-[#D4AF37] backdrop-blur-sm">
            COM
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onUse?.(item); }}
            className="flex items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-[11px] font-bold text-black transition-colors hover:bg-[#e5c448]"
          >
            <Zap className="h-3.5 w-3.5" />
            Utiliser
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 p-3">
        {/* Title + category */}
        <div className="flex items-start gap-2">
          <div className={cn('flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium', categoryStyle)}>
            <Icon className="h-2.5 w-2.5" />
            {item.category}
          </div>
        </div>
        <p className="truncate text-[12px] font-semibold text-white/90" title={item.title}>{item.title}</p>

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/35">
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="text-[10px] text-white/25">+{item.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Stats + actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onLike?.(item.id); }}
            className={cn('flex items-center gap-1 text-[10px] transition-colors hover:text-red-400', item.liked ? 'text-red-400' : 'text-white/30')}
          >
            <Heart className={cn('h-3 w-3', item.liked && 'fill-current')} />
            {item.likes ?? 0}
          </button>
          <span className="flex items-center gap-1 text-[10px] text-white/25">
            <Download className="h-3 w-3" />
            {item.downloads ?? 0}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onUse?.(item); }}
            className="ml-auto flex items-center gap-1 rounded-md border border-[#D4AF37]/30 px-2 py-1 text-[10px] text-[#D4AF37] transition-colors hover:bg-[#D4AF37]/10"
          >
            Utiliser
          </button>
        </div>
      </div>
    </div>
  );
}
