/**
 * CaptureSourceManager
 * Entry point for choosing the video source before entering the studio.
 * Sources: webcam, phone (QR), screen, external camera, file upload, live.
 */
import React, { useState, useEffect } from 'react';
import {
  Video, Camera, Monitor, Smartphone, Upload,
  Radio, ExternalLink, Check, ChevronRight, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SOURCES = [
  {
    id: 'webcam',
    icon: Video,
    color: 'blue',
    label: 'Webcam de cet ordinateur',
    sub: 'Caméra intégrée ou USB connectée au PC',
    badge: 'Recommandé',
    badgeColor: 'bg-blue-500/20 text-blue-300',
    available: () => !!navigator.mediaDevices?.getUserMedia,
  },
  {
    id: 'phone',
    icon: Smartphone,
    color: 'amber',
    label: 'Caméra du téléphone',
    sub: 'Scanne un QR code pour utiliser ton téléphone comme caméra',
    badge: 'QR Code',
    badgeColor: 'bg-amber-500/20 text-amber-300',
    available: () => true,
  },
  {
    id: 'screen',
    icon: Monitor,
    color: 'purple',
    label: 'Capturer l\'écran',
    sub: 'Enregistre ton écran, une fenêtre ou un onglet',
    badge: 'Screencast',
    badgeColor: 'bg-purple-500/20 text-purple-300',
    available: () => !!navigator.mediaDevices?.getDisplayMedia,
  },
  {
    id: 'external',
    icon: Camera,
    color: 'emerald',
    label: 'Caméra externe',
    sub: 'Caméra USB, HDMI ou périphérique de capture',
    badge: 'Professionnel',
    badgeColor: 'bg-emerald-500/20 text-emerald-300',
    available: () => !!navigator.mediaDevices?.getUserMedia,
  },
  {
    id: 'upload',
    icon: Upload,
    color: 'sky',
    label: 'Importer une vidéo',
    sub: 'Téléverse un fichier déjà enregistré (MP4, MOV, WebM…)',
    badge: 'Fichier',
    badgeColor: 'bg-sky-500/20 text-sky-300',
    available: () => true,
  },
  {
    id: 'live',
    icon: Radio,
    color: 'red',
    label: 'Enregistrement live',
    sub: 'Capture depuis un flux live ou RTMP entrant',
    badge: 'Bientôt',
    badgeColor: 'bg-red-500/20 text-red-300',
    available: () => false,
    disabled: true,
  },
];

const COLOR_STYLES = {
  blue:    { ring: 'ring-blue-500/30',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    hover: 'hover:border-blue-500/40 hover:bg-blue-500/5' },
  amber:   { ring: 'ring-amber-500/30',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   hover: 'hover:border-amber-500/40 hover:bg-amber-500/5' },
  purple:  { ring: 'ring-purple-500/30',  bg: 'bg-purple-500/10',  text: 'text-purple-400',  hover: 'hover:border-purple-500/40 hover:bg-purple-500/5' },
  emerald: { ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400', hover: 'hover:border-emerald-500/40 hover:bg-emerald-500/5' },
  sky:     { ring: 'ring-sky-500/30',     bg: 'bg-sky-500/10',     text: 'text-sky-400',     hover: 'hover:border-sky-500/40 hover:bg-sky-500/5' },
  red:     { ring: 'ring-red-500/30',     bg: 'bg-red-500/10',     text: 'text-red-400',     hover: '' },
};

export default function CaptureSourceManager({ onSelectSource }) {
  const [availabilityMap, setAvailabilityMap] = useState({});

  useEffect(() => {
    const map = {};
    SOURCES.forEach((s) => { map[s.id] = s.available(); });
    setAvailabilityMap(map);
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1 pb-2">
        <p className="text-sm font-semibold text-white">Comment veux-tu créer ta vidéo ?</p>
        <p className="text-xs text-gray-500">Choisis la source de captation — le montage et l'IA se font toujours dans ce studio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SOURCES.map((source) => {
          const avail = availabilityMap[source.id] ?? true;
          const disabled = source.disabled || !avail;
          const col = COLOR_STYLES[source.color] || COLOR_STYLES.sky;
          const Icon = source.icon;

          return (
            <button
              key={source.id}
              type="button"
              onClick={() => !disabled && onSelectSource?.(source.id)}
              disabled={disabled}
              className={`
                group relative flex flex-col gap-3 rounded-2xl border border-white/8 p-4 text-left transition-all
                ${disabled ? 'opacity-40 cursor-not-allowed' : `cursor-pointer ${col.hover} active:scale-[0.98]`}
              `}
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${col.ring} ${col.bg}`}>
                <Icon className={`w-5 h-5 ${col.text}`} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white">{source.label}</p>
                  {source.badge && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 ${source.badgeColor}`}>
                      {source.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{source.sub}</p>
              </div>

              {/* Arrow */}
              {!disabled && (
                <ChevronRight className="absolute top-4 right-4 w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
              )}
            </button>
          );
        })}
      </div>

      {/* Architecture note */}
      <div className="rounded-xl border border-white/5 bg-white/2 px-4 py-3 flex items-start gap-3">
        <Wifi className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-[#D4AF37] font-medium">Capture Source Manager</span> — La vidéo peut venir de n'importe quelle source.
          Le montage, l'analyse IA et la génération SmartBoard se font toujours dans ce studio web.
        </p>
      </div>
    </div>
  );
}
