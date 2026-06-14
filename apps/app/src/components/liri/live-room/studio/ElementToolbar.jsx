import React from 'react';
import { Type, Pilcrow, Image as ImageIcon, Quote, BadgePlus } from 'lucide-react';

const ITEMS = [
  { id: 'title', label: 'Titre', icon: Type },
  { id: 'paragraph', label: 'Paragraphe', icon: Pilcrow },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'quote', label: 'Citation', icon: Quote },
  { id: 'badge', label: 'Badge', icon: BadgePlus },
];

export default function ElementToolbar({ onAdd }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onAdd?.(item.id)}
            className="h-9 px-3 rounded-xl border border-white/12 bg-white/[0.04] text-gray-200 text-xs inline-flex items-center gap-1.5 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:text-[var(--school-accent)]"
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
