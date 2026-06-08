import React from 'react';
import { ArrowRight } from 'lucide-react';
import { MAQ_THEME } from '@/components/maquette/maqTheme';
import { MaqNav } from '@/components/maquette/MaqNav';
import { MaqFooter } from '@/components/maquette/MaqFooter';

const gold = { color: 'var(--gold)' };

const VALEURS = [
  { n: '01', t: 'Intégrité scientifique', d: 'Une approche rigoureuse qui ne sacrifie jamais la vérité sur l’autel du dogme ou de la facilité.' },
  { n: '02', t: 'Authenticité spirituelle', d: 'Un retour aux sources de la tradition primordiale, vécu dans le cœur et non seulement dans l’intellect.' },
  { n: '03', t: 'Responsabilité éthique', d: 'La connaissance n’est rien sans la conscience de ses conséquences sur soi et sur le monde.' },
  { n: '04', t: 'Transformation consciente', d: 'Le but n’est pas l’accumulation de savoir, mais l’élévation vibratoire de l’être.' },
];

const ENGAGEMENTS = [
  { t: 'Envers les étudiants', d: 'Ne jamais diluer la vérité pour plaire, ni retenir une clé pour dominer.' },
  { t: 'Envers la science', d: 'Accepter la critique, la révision et l’évolution permanente des modèles.' },
  { t: 'Envers l’Afrique', d: 'Œuvrer sans relâche pour qu’elle retrouve sa place de guide spirituel.' },
  { t: 'Envers l’humanité', d: 'Partager ces lumières avec tout être qui cherche sincèrement la vérité.' },
];

export default function MaquetteMission() {
  return (
    <div className="mq2 fixed inset-0 z-[100] overflow-y-auto" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <style>{MAQ_THEME}</style>
      <MaqNav active="mission" />

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden border-b py-28" style={{ borderColor: 'var(--border)' }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to right, var(--grid) 1px, transparent 1px), linear-gradient(to bottom, var(--grid) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 45%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 45%, transparent 100%)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Notre mission</p>
          <h1 className="mq-display mt-5 text-5xl font-semibold leading-[0.95] sm:text-7xl">Restaurer la dignité.</h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
            Une vie dédiée à la restauration de la dignité intellectuelle et spirituelle de l&apos;Afrique
            par la science sacrée.
          </p>
        </div>
      </section>

      {/* ===== Quatre valeurs ===== */}
      <section className="relative border-b py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Ce qui nous tient</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">Quatre valeurs.</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-px overflow-hidden rounded-2xl border text-left sm:grid-cols-2" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
            {VALEURS.map((v) => (
              <div key={v.n} className="p-8" style={{ background: 'var(--bg)' }}>
                <div className="text-sm font-bold" style={gold}>{v.n}</div>
                <div className="mq-display mt-2 text-2xl font-semibold">{v.t}</div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted2)' }}>{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Nos engagements ===== */}
      <section className="relative border-b py-24" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.4em]" style={gold}>Nos engagements</p>
            <h2 className="mq-display mt-4 text-4xl font-semibold sm:text-5xl">Envers qui, pour quoi.</h2>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
            {ENGAGEMENTS.map((e) => (
              <div key={e.t} className="rounded-2xl border p-7" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <div className="mq-display text-xl font-semibold" style={gold}>{e.t}</div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{e.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Statement ===== */}
      <section className="relative border-b py-28 text-center" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-4xl px-6">
          <blockquote className="mq-display text-3xl font-semibold leading-tight sm:text-5xl">
            « L&apos;Afrique est le <span style={{ color: 'var(--gold)', fontStyle: 'italic' }}>laboratoire spirituel</span> de l&apos;humanité de demain. »
          </blockquote>
          <div className="mt-10">
            <a href="/t/isna/programme" className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition hover:brightness-110" style={{ background: 'var(--gold)', color: '#0d0b09' }}>
              Découvrir le programme <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <MaqFooter />
    </div>
  );
}
