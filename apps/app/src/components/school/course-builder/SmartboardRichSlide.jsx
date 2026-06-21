import React, { useMemo } from 'react';
import {
  Sparkles, Lightbulb, Target, Brain, Star, ArrowRight,
  BookOpen, Sigma, Sprout, Globe, Atom, Network, Search, Rocket,
  FlaskConical, TrendingUp, Activity, Waypoints, Circle, Clock,
} from 'lucide-react';

/**
 * Slide SmartBoard PÉDAGOGIQUE PREMIUM (style référence : carte claire structurée).
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

const BRANCH_STYLES = [
  { border: '#cbe3c9', icon: '#3f8f3a', label: '#2f6f2b', bg: '#f3f9f2' },
  { border: '#d9cdf0', icon: '#6d51c4', label: '#5a3fb0', bg: '#f6f3fc' },
  { border: '#f0dcae', icon: '#b8841a', label: '#9a6b13', bg: '#fdf8ec' },
  { border: '#bfe6dc', icon: '#15806c', label: '#15806c', bg: '#f0faf6' },
  { border: '#f4c9c9', icon: '#c0392b', label: '#a3291f', bg: '#fdf3f2' },
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
    <div className={`rounded-2xl overflow-hidden ${className}`} style={{ background: '#0a0e16' }}>
      {/* En-tête tableau */}
      <div className="flex items-center justify-between" style={{ padding: `8px ${pad}px 0` }}>
        <span className="inline-flex items-center gap-1.5" style={{ color: '#d8b24a', fontSize: 12, fontWeight: 600, letterSpacing: '.05em' }}>
          <Sparkles className="w-3.5 h-3.5" /> SMARTBOARD · CARTE {chapterNum}
        </span>
        {time ? <span style={{ color: '#7f879c', fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>{time}</span> : null}
      </div>

      {/* Carte claire */}
      <div style={{ margin: `${compact ? 8 : 10}px ${pad}px ${pad}px`, background: '#fff', borderRadius: 14, padding: compact ? 16 : 22 }}>
        <h3 style={{ margin: 0, fontSize: compact ? 19 : 25, fontWeight: 600, color: '#0f172a', lineHeight: 1.13, letterSpacing: '-0.01em' }}>
          {data.title}
        </h3>
        {data.subtitle ? (
          <p style={{ margin: '6px 0 0', fontSize: compact ? 13 : 14, fontWeight: 600, color: '#2563eb', lineHeight: 1.35 }}>{data.subtitle}</p>
        ) : null}

        {/* Image qui explique */}
        {data.image ? (
          <div style={{ margin: `${compact ? 12 : 15}px 0 0`, height: compact ? 120 : 158, borderRadius: 12, overflow: 'hidden', background: '#0c1430' }}>
            <img src={data.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} />
          </div>
        ) : null}

        {/* Idée centrale + Objectif */}
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 12, marginTop: 16 }}>
          {data.ideeCentrale ? (
            <div style={{ display: 'flex', gap: 11 }}>
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lightbulb className="w-[18px] h-[18px]" style={{ color: '#fff' }} />
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600, color: '#1e40af' }}>Idée centrale</p>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.45 }}>{data.ideeCentrale}</p>
              </div>
            </div>
          ) : null}
          {data.objectif ? (
            <div style={{ display: 'flex', gap: 11, background: '#eef4ff', borderRadius: 10, padding: 12 }}>
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target className="w-[18px] h-[18px]" style={{ color: '#fff' }} />
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 600, color: '#1e3a8a' }}>Objectif</p>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.45 }}>{data.objectif}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Carte mentale */}
        {data.branches.length ? (
          <div style={{ marginTop: 16, background: '#f8fafc', border: '1px solid #eef1f5', borderRadius: 12, padding: 14 }}>
            <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Brain className="w-[17px] h-[17px]" /> Carte mentale
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ background: '#0f2350', borderRadius: 11, padding: '10px 16px', textAlign: 'center', minWidth: 150 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: '.02em' }}>{data.centerLabel || 'Concept'}</div>
                {data.centerSub ? <div style={{ fontSize: 11, color: '#9db4e3', marginTop: 2 }}>{data.centerSub}</div> : null}
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
                        {b.sub ? <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{b.sub}</div> : null}
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
          <div style={{ marginTop: 14, background: '#fef9ec', border: '1px solid #f6ecd0', borderRadius: 12, padding: 13, display: 'flex', gap: 13, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', background: '#e8b53a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star className="w-[19px] h-[19px]" style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1, minWidth: 170 }}>
              <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: '#8a6a12' }}>À retenir</p>
              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.4 }}>{data.aRetenir || '—'}</p>
            </div>
            {!compact ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb' }}>
                {data.process.map((p, i) => {
                  const Ico = iconFor(p.icon, [Search, Waypoints, Lightbulb, Rocket][i % 4]);
                  return (
                    <React.Fragment key={i}>
                      {i > 0 ? <ArrowRight className="w-3 h-3" style={{ color: '#94a3b8' }} /> : null}
                      <div style={{ textAlign: 'center' }}>
                        <Ico className="w-[18px] h-[18px]" style={{ margin: '0 auto' }} />
                        <div style={{ fontSize: 10, marginTop: 2 }}>{p.label}</div>
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 999, padding: '3px 9px' }}>
              <Clock className="w-3 h-3" /> {data.niveau}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
