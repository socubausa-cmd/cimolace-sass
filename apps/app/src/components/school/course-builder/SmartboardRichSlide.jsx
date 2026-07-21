import React, { useMemo } from 'react';
import {
  Sparkles, Lightbulb, Target, Brain, Star, ArrowRight,
  BookOpen, Sigma, Sprout, Globe, Atom, Network, Search, Rocket,
  FlaskConical, TrendingUp, Activity, Waypoints, Circle, Clock,
} from 'lucide-react';
import SmartboardCanvasImage from '@/components/media/SmartboardCanvasImage';

/**
 * Slide SmartBoard PÉDAGOGIQUE PREMIUM — charte LIRI chaude (immersive, fond sombre).
 * « Une idée = une slide » : titre-idée + sous-titre, image qui EXPLIQUE, idée centrale,
 * objectif, carte mentale (concept central + 3-5 branches), « à retenir » + mini-process.
 *
 * Rendu À PARTIR d'un `slideContent` riche (généré par l'IA selon le prompt agent) ;
 * repli gracieux sur les données brutes de la carte (label/summary/childLabels) tant
 * que le contenu riche n'est pas généré.
 *
 * @param {object} card           Carte du deck { label, summary, keyPoints, childLabels, illustrationUrl, time, chapterIndex }.
 * @param {object|null} slide     Contenu riche { title, subtitle, ideeCentrale, objectif, branches:[{icon,label,sub}], aRetenir, process:[{icon,label}], niveau }.
 * @param {'full'|'compact'} density
 * @param {number} chapterNum     Numéro affiché (Carte N).
 * @param {string} time           Horodatage (mm:ss).
 * @param {string} className
 */

const ICON_MAP = {
  book: BookOpen, function: Sigma, variation: Sigma, leaf: Sprout, plant: Sprout,
  globe: Globe, world: Globe, brain: Brain, atom: Atom, network: Network,
  search: Search, observe: Search, rocket: Rocket, apply: Rocket, flask: FlaskConical,
  chart: TrendingUp, trend: TrendingUp, wave: Activity, link: Waypoints, relier: Waypoints,
  bulb: Lightbulb, idea: Lightbulb, target: Target, star: Star,
};
const iconFor = (name, fallback = Circle) => ICON_MAP[String(name || '').toLowerCase().trim()] || fallback;

// Variantes CHAUDES (coral / vert sauge / clay / coral clair / sable) — aucune couleur froide.
const BRANCH_STYLES = [
  { border: 'rgba(217,119,87,.30)',  icon: '#d97757', label: '#e8b6a3', bg: 'rgba(217,119,87,.10)' },
  { border: 'rgba(159,191,143,.32)', icon: '#9fbf8f', label: '#bcd4ad', bg: 'rgba(159,191,143,.10)' },
  { border: 'rgba(194,104,63,.32)',  icon: '#c2683f', label: '#e8b6a3', bg: 'rgba(194,104,63,.10)' },
  { border: 'rgba(232,182,163,.30)', icon: '#e8b6a3', label: '#f0d0c2', bg: 'rgba(232,182,163,.08)' },
  { border: 'rgba(176,173,163,.30)', icon: '#b0ada3', label: '#cfccc4', bg: 'rgba(176,173,163,.08)' },
];

const DEFAULT_PROCESS = [
  { icon: 'search', label: 'Observer' },
  { icon: 'relier', label: 'Relier' },
  { icon: 'bulb', label: 'Comprendre' },
  { icon: 'rocket', label: 'Appliquer' },
];

function firstSentence(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

export default function SmartboardRichSlide({
  card,
  slide = null,
  density = 'full',
  chapterNum = 1,
  time = '',
  className = '',
}) {
  const data = useMemo(() => {
    const c = card || {};
    const branchesRaw = Array.isArray(slide?.branches) && slide.branches.length
      ? slide.branches
      : (Array.isArray(c.childLabels) ? c.childLabels : []).map((l) => ({ label: l, sub: '', icon: '' }));
    return {
      title: String(slide?.title || c.label || 'Carte').trim(),
      subtitle: String(slide?.subtitle || '').trim(),
      ideeCentrale: String(slide?.ideeCentrale || c.summary || '').trim(),
      objectif: String(slide?.objectif || '').trim(),
      branches: branchesRaw.slice(0, 5).map((b) => ({
        icon: b.icon || '',
        label: String(b.label || '').trim(),
        sub: String(b.sub || '').trim(),
      })).filter((b) => b.label),
      aRetenir: String(slide?.aRetenir || (Array.isArray(c.keyPoints) ? c.keyPoints[0] : '') || '').trim(),
      process: Array.isArray(slide?.process) && slide.process.length ? slide.process.slice(0, 4) : DEFAULT_PROCESS,
      image: c.illustrationUrl || null,
      niveau: String(slide?.niveau || '').trim(),
      centerLabel: String(slide?.centerLabel || c.label || '').trim(),
      centerSub: String(slide?.centerSub || '').trim(),
    };
  }, [card, slide]);

  const compact = density === 'compact';
  const pad = compact ? 14 : 20;

  return (
    <div className={`rounded-2xl overflow-hidden ${className}`} style={{ background: '#1f1e1c', border: '1px solid rgba(245,244,238,.08)' }}>
      {/* En-tête tableau */}
      <div className="flex items-center justify-between" style={{ padding: `8px ${pad}px 0` }}>
        <span className="inline-flex items-center gap-1.5" style={{ color: '#d97757', fontSize: 12, fontWeight: 600, letterSpacing: '.05em' }}>
          <Sparkles className="w-3.5 h-3.5" /> SMARTBOARD · CARTE {chapterNum}
        </span>
        {time ? <span style={{ color: '#82807a', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>{time}</span> : null}
      </div>

      {/* Carte (surface chaude élevée) */}
      <div style={{ margin: `${compact ? 8 : 10}px ${pad}px ${pad}px`, background: '#2b2926', border: '1px solid rgba(245,244,238,.07)', borderRadius: 14, padding: compact ? 16 : 22 }}>
        <h3 style={{ margin: 0, fontSize: compact ? 19 : 25, fontWeight: 600, color: '#f5f4ee', lineHeight: 1.13, letterSpacing: '-0.01em' }}>
          {data.title}
        </h3>
        {data.subtitle ? (
          <p style={{ margin: '6px 0 0', fontSize: compact ? 13 : 14, fontWeight: 600, color: '#e8b6a3', lineHeight: 1.35 }}>{data.subtitle}</p>
        ) : null}

        {/* Image qui explique */}
        {data.image ? (
          <div style={{ margin: `${compact ? 12 : 15}px 0 0`, height: compact ? 120 : 158, borderRadius: 12, overflow: 'hidden', background: '#1a1917' }}>
            <SmartboardCanvasImage src={data.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} />
          </div>
        ) : null}

        {/* Idée centrale + Objectif */}
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 12, marginTop: 16 }}>
          {data.ideeCentrale ? (
            <div style={{ display: 'flex', gap: 11 }}>
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: 'rgba(217,119,87,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lightbulb className="w-[18px] h-[18px]" style={{ color: '#e8b6a3' }} />
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600, color: '#e8b6a3' }}>Idée centrale</p>
                <p style={{ margin: 0, fontSize: 13, color: '#b0ada3', lineHeight: 1.45 }}>{data.ideeCentrale}</p>
              </div>
            </div>
          ) : null}
          {data.objectif ? (
            <div style={{ display: 'flex', gap: 11, background: 'rgba(194,104,63,.10)', border: '1px solid rgba(194,104,63,.22)', borderRadius: 10, padding: 12 }}>
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: '#c2683f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target className="w-[18px] h-[18px]" style={{ color: '#2a1c14' }} />
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600, color: '#e8b6a3' }}>Objectif</p>
                <p style={{ margin: 0, fontSize: 13, color: '#b0ada3', lineHeight: 1.45 }}>{data.objectif}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Carte mentale */}
        {data.branches.length ? (
          <div style={{ marginTop: 16, background: '#262624', border: '1px solid rgba(245,244,238,.07)', borderRadius: 12, padding: 14 }}>
            <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#e8b6a3', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Brain className="w-[17px] h-[17px]" /> Carte mentale
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ background: '#d97757', borderRadius: 11, padding: '10px 16px', textAlign: 'center', minWidth: 150 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2a1c14', letterSpacing: '.02em' }}>{data.centerLabel || 'Concept'}</div>
                {data.centerSub ? <div style={{ fontSize: 11, color: 'rgba(42,28,20,.72)', marginTop: 2 }}>{data.centerSub}</div> : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 9, width: '100%' }}>
                {data.branches.map((b, i) => {
                  const st = BRANCH_STYLES[i % BRANCH_STYLES.length];
                  const Ico = iconFor(b.icon, [BookOpen, Sigma, Sprout, Globe, Atom][i % 5]);
                  return (
                    <div key={i} style={{ border: `1px solid ${st.border}`, background: st.bg, borderRadius: 9, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Ico className="w-4 h-4" style={{ color: st.icon, marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: st.label, lineHeight: 1.2 }}>{b.label}</div>
                        {b.sub ? <div style={{ fontSize: 11, color: '#82807a', marginTop: 1 }}>{b.sub}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {/* À retenir + process */}
        {(data.aRetenir || !compact) ? (
          <div style={{ marginTop: 14, background: 'rgba(217,119,87,.10)', border: '1px solid rgba(217,119,87,.25)', borderRadius: 12, padding: 13, display: 'flex', gap: 13, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', background: '#d97757', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star className="w-[19px] h-[19px]" style={{ color: '#2a1c14' }} />
            </div>
            <div style={{ flex: 1, minWidth: 170 }}>
              <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: '#e8b6a3' }}>À retenir</p>
              <p style={{ margin: 0, fontSize: 13, color: '#b0ada3', lineHeight: 1.4 }}>{data.aRetenir || '—'}</p>
            </div>
            {!compact ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#d97757' }}>
                {data.process.map((p, i) => {
                  const Ico = iconFor(p.icon, [Search, Waypoints, Lightbulb, Rocket][i % 4]);
                  return (
                    <React.Fragment key={i}>
                      {i > 0 ? <ArrowRight className="w-3 h-3" style={{ color: '#82807a' }} /> : null}
                      <div style={{ textAlign: 'center' }}>
                        <Ico className="w-[18px] h-[18px]" style={{ margin: '0 auto' }} />
                        <div style={{ fontSize: 10, marginTop: 2, color: '#e8b6a3' }}>{p.label}</div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {data.niveau && !compact ? (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#b0ada3', background: 'rgba(245,244,238,.06)', borderRadius: 999, padding: '3px 9px' }}>
              <Clock className="w-3 h-3" /> {data.niveau}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
