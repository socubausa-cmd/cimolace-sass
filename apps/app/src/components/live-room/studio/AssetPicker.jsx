import React from 'react';
import { ImagePlus } from 'lucide-react';

export default function AssetPicker({ onPick }) {
  return (
    <label className="h-9 px-3 rounded-xl border border-white/12 bg-white/[0.04] text-gray-200 text-xs inline-flex items-center gap-1.5 hover:border-[#D4AF37]/30 hover:text-[#D4AF37] cursor-pointer">
      <ImagePlus className="w-3.5 h-3.5" />
      Importer une image
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fr = new FileReader();
          fr.onload = () => onPick?.(String(fr.result || ''));
          fr.readAsDataURL(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}
