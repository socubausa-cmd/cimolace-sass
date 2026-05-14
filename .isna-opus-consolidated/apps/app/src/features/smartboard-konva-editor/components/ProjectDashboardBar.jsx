/**
 * ProjectDashboardBar — barre de stats projet (Module 14).
 * Affiche : slides, qualite moyenne, duree totale, overloaded, vides.
 */
import React from 'react';
import { BarChart2, Clock, AlertTriangle, CheckCircle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

function Stat({ icon: Icon, label, value, color, title }) {
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: color || 'rgba(255,255,255,0.4)' }} />
      <span className="text-[9px] text-white/40">{label}</span>
      <span className="text-[10px] font-bold" style={{ color: color || 'rgba(255,255,255,0.8)' }}>
        {value}
      </span>
    </div>
  );
}

export default function ProjectDashboardBar({ projectQuality, totalDurationMinutes, className }) {
  if (!projectQuality) return null;

  const { avgScore, projectLevel, projectColor, stats } = projectQuality;

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/[0.06] bg-[#080a0f]/95 px-4 py-1.5',
        className,
      )}
    >
      {/* Score global */}
      <div className="flex items-center gap-1.5">
        <BarChart2 className="h-3.5 w-3.5 shrink-0" style={{ color: projectColor }} />
        <span className="text-[9px] text-white/40">Qualite moy.</span>
        <span className="text-[10px] font-bold capitalize" style={{ color: projectColor }}>
          {avgScore}/100 · {projectLevel}
        </span>
      </div>

      <div className="h-3 w-px bg-white/10" />

      <Stat
        icon={Layers}
        label="Slides"
        value={stats.totalSlides}
        title="Nombre total de scenes"
      />

      {totalDurationMinutes > 0 && (
        <>
          <div className="h-3 w-px bg-white/10" />
          <Stat
            icon={Clock}
            label="Duree"
            value={`${totalDurationMinutes} min`}
            color="#60a5fa"
            title="Duree totale estimee"
          />
        </>
      )}

      {stats.overloadedCount > 0 && (
        <>
          <div className="h-3 w-px bg-white/10" />
          <Stat
            icon={AlertTriangle}
            label="Surchargees"
            value={stats.overloadedCount}
            color="#f59e0b"
            title="Slides avec trop de contenu"
          />
        </>
      )}

      {stats.emptyCount > 0 && (
        <>
          <div className="h-3 w-px bg-white/10" />
          <Stat
            icon={AlertTriangle}
            label="Vides"
            value={stats.emptyCount}
            color="#ef4444"
            title="Slides sans contenu"
          />
        </>
      )}

      {stats.excellentCount > 0 && (
        <>
          <div className="h-3 w-px bg-white/10" />
          <Stat
            icon={CheckCircle}
            label="Excellentes"
            value={stats.excellentCount}
            color="#22c55e"
            title="Slides avec score excellent"
          />
        </>
      )}
    </div>
  );
}
