import React, { useEffect, useMemo, useState } from 'react';
import { Heart, Check, ArrowRight, ShieldCheck, Loader2, X, Sparkles, Users, BadgeCheck, Camera } from 'lucide-react';
import { cagnotteApi } from '@/lib/api-v2';

/**
 * StudioCagnottePage — /studio-pedagogique : financement participatif du studio
 * de l'école, ÉQUIPEMENT PAR ÉQUIPEMENT. Ce n'est pas une boutique : chaque
 * carte est un objectif à financer collectivement. Les montants viennent des
 * transactions réellement enregistrées (Stripe / Mobile Money, une campagne
 * cagnotte par équipement) ; le paiement s'effectue sur /cagnotte?slug=…
 * L'objectif global est CALCULÉ depuis les équipements — jamais codé en dur.
 */

export const eur = (cents) => `${Math.round((cents || 0) / 100).toLocaleString('fr-FR')} €`;

export function Progression({ pct, fine = false }) {
  return (
    <div className={`w-full overflow-hidden rounded-full bg-white/[0.07] ${fine ? 'h-2' : 'h-3'}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-[#b5642f] to-[#d97757] transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

/** Fenêtre de contribution : montants proposés + libre + « financer le reste ». */
export function ModalContribution({ equipement, onClose, retour = '/studio-pedagogique' }) {
  const [montant, setMontant] = useState(equipement.presetReste ? Math.ceil((equipement.restantCents || 0) / 100) : null);
  const [libre, setLibre] = useState('');
  const libreN = Number(String(libre).replace(',', '.'));
  const restantEur = Math.ceil((equipement.restantCents || 0) / 100);
  const fonds = equipement.slug === 'studio-fonds';
  const presets = (fonds ? [10, 25, 50, 100, 250] : [10, 20, 50, 100, 200]).filter((v) => fonds || v <= restantEur);
  const choisi = libre !== '' && Number.isFinite(libreN) && libreN >= 1 ? Math.floor(libreN) : montant;
  const plafonne = !fonds && choisi ? Math.min(choisi, restantEur) : choisi;
  const valide = Number.isFinite(plafonne) && plafonne >= 1;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const contribuer = () => {
    if (!valide) return;
    window.location.href = `/cagnotte?slug=${encodeURIComponent(equipement.slug)}&amount=${plafonne}&retour=${encodeURIComponent(retour)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`Contribuer : ${equipement.label}`} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#2b2926] p-6 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">Votre contribution</p>
            <h3 className="mt-1 text-[17px] font-extrabold leading-snug text-[#f5f4ee]">
              {fonds ? 'Soutenir le studio librement' : `Vous contribuez au financement de : ${equipement.label}`}
            </h3>
            {!fonds && <p className="mt-1 text-[13px] text-[#e8a184]">{eur(equipement.restantCents)} restent nécessaires.</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#f5f4ee]/50 hover:bg-white/[0.06] hover:text-[#f5f4ee]"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {presets.map((v) => (
            <button key={v} type="button" onClick={() => { setMontant(v); setLibre(''); }}
              className={`rounded-xl border py-2.5 text-[15px] font-bold transition-colors ${
                libre === '' && montant === v ? 'border-[#d97757] bg-[#d97757] text-[#1c1a18]' : 'border-white/10 text-[#f5f4ee]/85 hover:border-[#d97757]/60'}`}>
              {v} €
            </button>
          ))}
          {!fonds && restantEur >= 1 && (
            <button type="button" onClick={() => { setMontant(restantEur); setLibre(''); }}
              className={`col-span-3 rounded-xl border py-2.5 text-[14px] font-bold transition-colors ${
                libre === '' && montant === restantEur ? 'border-[#d97757] bg-[#d97757] text-[#1c1a18]' : 'border-[#d97757]/50 text-[#e8a184] hover:bg-[#d97757]/10'}`}>
              Financer les {restantEur} € restants
            </button>
          )}
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-[12px] font-semibold text-[#f5f4ee]/55">Autre montant (€)</span>
          <input type="number" min="1" max={fonds ? 100000 : restantEur} inputMode="numeric" value={libre}
            onChange={(e) => { setLibre(e.target.value); setMontant(null); }}
            placeholder={fonds ? 'Montant libre' : `1 à ${restantEur}`}
            className="w-full rounded-xl border border-white/10 bg-[#262624] px-3 py-2.5 text-sm text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/50 focus:border-[#d97757]" />
          {!fonds && libre !== '' && libreN > restantEur && (
            <p className="mt-1 text-[12px] text-[#e8a184]" aria-live="polite">Plafonné à {restantEur} € — le reste peut aller au fonds général du studio.</p>
          )}
        </label>

        <button type="button" disabled={!valide} onClick={contribuer}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] py-3.5 text-[15px] font-bold text-[#1c1a18] shadow-[0_10px_30px_rgba(217,119,87,0.3)] transition-all hover:bg-[#e08b6d] disabled:cursor-not-allowed disabled:opacity-40">
          Contribuer{valide ? ` — ${plafonne} €` : ''} <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-2 text-center text-[11.5px] text-[#f5f4ee]/45">Paiement sécurisé par carte (Stripe) ou Mobile Money — votre nom n'apparaît que si vous le donnez.</p>
      </div>
    </div>
  );
}

function CarteEquipement({ e, onParticiper }) {
  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border transition-colors ${e.finance ? 'border-[#7fb98a]/40 bg-[#7fb98a]/[0.05]' : 'border-white/10 bg-[#2b2926]'}`}>
      {/* Zone image CLAIRE et uniforme : les photos produit (fonds blancs/transparents)
          et les compositions de packs y restent lisibles et homogènes sur carte sombre. */}
      <a href={`/studio-pedagogique/${e.slug}`} className="relative block aspect-[8/5] w-full overflow-hidden bg-[#f2efe9]" aria-label={`Voir la fiche : ${e.label}`}>
        {e.image ? (
          // eager (pas de loading=lazy) : le lazy natif ne se déclenche pas dans
          // cette coque (constaté) — 10 images légères n'ont rien à différer.
          <img src={e.image} alt={e.label} className="h-full w-full object-contain p-3" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[#f5f4ee]/25"><Camera className="h-10 w-10" /></div>
        )}
        {e.finance && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#7fb98a] px-3 py-1 text-[11.5px] font-bold text-[#14281a]">
            <Check className="h-3.5 w-3.5" /> Financé
          </span>
        )}
        {e.achete?.installe && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#1c1a18]/85 px-3 py-1 text-[11.5px] font-bold text-[#a9d4b0]">
            <BadgeCheck className="h-3.5 w-3.5" /> Installé dans le studio
          </span>
        )}
      </a>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[16px] font-extrabold leading-snug text-[#f5f4ee]">
            <a href={`/studio-pedagogique/${e.slug}`} className="transition-colors hover:text-[#e8a184]">{e.label}</a>
          </h3>
          <span className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[13px] font-bold text-[#f5f4ee]/80">{e.prixEur.toLocaleString('fr-FR')} €</span>
        </div>
        <a href={`/studio-pedagogique/${e.slug}`} className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#e8a184]/80 transition-colors hover:text-[#e8a184]">
          Voir la fiche complète <ArrowRight className="h-3 w-3" />
        </a>
        {e.desc && <p className="mt-1 text-[13px] font-semibold text-[#e8a184]">{e.desc}</p>}
        {e.utilite && <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#f5f4ee]/65">{e.utilite}</p>}

        <div className="mt-auto pt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
            <span className="font-semibold text-[#f5f4ee]/80">{eur(e.collecteCents)} / {eur(e.objectifCents)} financés</span>
            <span className="font-bold text-[#e8a184]">{e.pct} %</span>
          </div>
          <Progression pct={e.pct} fine />
          {e.finance ? (
            <div className="mt-3 space-y-2">
              <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#7fb98a]/40 bg-[#7fb98a]/10 py-2.5 text-[13.5px] font-bold text-[#a9d4b0]">
                <Check className="h-4 w-4" /> Équipement financé
              </div>
              {e.achete?.date && (
                <p className="text-center text-[12px] text-[#f5f4ee]/55">
                  Acheté le {e.achete.date}{e.achete.prixPayeEur ? ` · ${e.achete.prixPayeEur.toLocaleString('fr-FR')} € payés` : ''}
                  {e.achete.facture && <> · <a className="font-semibold text-[#e8a184] hover:underline" href={e.achete.facture} target="_blank" rel="noreferrer">preuve d'achat</a></>}
                </p>
              )}
              {e.achete?.photo && <img src={e.achete.photo} alt={`${e.label} — acheté`} loading="lazy" className="mx-auto max-h-36 rounded-lg" />}
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={() => onParticiper(e)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] py-2.5 text-[13.5px] font-bold text-[#1c1a18] transition-all hover:bg-[#e08b6d]">
                Participer à cet équipement
              </button>
              {e.restantCents > 0 && e.pct >= 40 && (
                <button type="button" onClick={() => onParticiper(e, true)}
                  className="w-full rounded-xl border border-[#d97757]/50 py-2 text-[12.5px] font-bold text-[#e8a184] transition-colors hover:bg-[#d97757]/10">
                  Financer les {Math.ceil(e.restantCents / 100)} € restants
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function StudioCagnottePage() {
  const [vue, setVue] = useState(null);
  const [erreur, setErreur] = useState('');
  const [modal, setModal] = useState(null); // équipement (ou pseudo-équipement fonds)

  useEffect(() => {
    cagnotteApi.studioOverview()
      .then(setVue)
      .catch(() => setErreur('Impossible de charger la campagne pour le moment — réessayez dans un instant.'));
  }, []);

  const fondsPseudo = useMemo(() => ({ slug: 'studio-fonds', label: 'Fonds général du studio', restantCents: 0 }), []);

  if (erreur) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#262624] px-6 text-center text-[#f5f4ee]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div><p className="text-[15px] font-semibold">{erreur}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-[#d97757] px-5 py-2.5 text-[14px] font-bold text-[#1c1a18]">Réessayer</button></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#262624] text-[#f5f4ee]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── HERO + progression globale ── */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.16]"
          style={{ background: 'radial-gradient(1100px 460px at 75% -10%, #d97757 0%, transparent 60%), radial-gradient(800px 460px at 8% 12%, #b5642f 0%, transparent 55%)' }} />
        <div className="relative mx-auto max-w-5xl px-5 pb-10 pt-14 sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d97757]/40 bg-[#d97757]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#e8a184]">
            <Heart className="h-3.5 w-3.5" /> Campagne communautaire · studio pédagogique
          </span>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl" style={{ textWrap: 'balance' }}>
            {vue?.titre || 'Ensemble, construisons notre studio pédagogique'}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#f5f4ee]/[0.72]">
            {vue?.intro || 'Chaque contribution, petite ou grande, nous rapproche de cet objectif.'}
          </p>

          {vue ? (
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#2b2926]/80 p-5 backdrop-blur sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[15px] sm:text-lg">
                  <strong className="text-2xl font-extrabold text-[#e8a184] sm:text-3xl">{eur(vue.collecteCents)}</strong>
                  <span className="text-[#f5f4ee]/65"> collectés sur </span>
                  <strong className="font-extrabold">{eur(vue.objectifCents)}</strong>
                </p>
                <p className="text-[14px] font-bold text-[#e8a184]">{vue.pct} % du studio financé</p>
              </div>
              <div className="mt-3"><Progression pct={vue.pct} /></div>
              {vue.cloturee && <p className="mt-3 text-[13px] font-semibold text-[#e8a184]">Cette campagne est clôturée — merci à tous les contributeurs.</p>}
            </div>
          ) : (
            <div className="mt-8 h-28 animate-pulse rounded-2xl bg-white/[0.04]" aria-label="Chargement de la campagne" />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">
        {/* ── Équipements à financer ── */}
        <h2 className="mt-4 text-xl font-bold sm:text-2xl">Les équipements à financer</h2>
        <p className="mt-1 text-[13.5px] text-[#f5f4ee]/60">Chaque équipement peut être financé par plusieurs personnes, jusqu'à atteindre son objectif.</p>
        {vue ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {vue.equipements.map((e) => <CarteEquipement key={e.slug} e={e} onParticiper={(eq, reste) => !vue.cloturee && setModal(reste ? { ...eq, presetReste: true } : eq)} />)}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-96 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
        )}

        {/* ── Nous avons déjà ── */}
        {vue?.dejaDisponibles?.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold">Nous avons déjà</h2>
            <p className="mt-1 text-[13.5px] text-[#f5f4ee]/60">Le projet part d'une base matérielle réelle — vos contributions complètent le studio.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {vue.dejaDisponibles.map((d) => (
                <div key={d.label} className="rounded-2xl border border-[#7fb98a]/25 bg-[#7fb98a]/[0.04] p-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7fb98a]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#a9d4b0]">
                    <Check className="h-3 w-3" /> Déjà disponible
                  </span>
                  <p className="mt-2 text-[14px] font-bold text-[#f5f4ee]">{d.label}</p>
                  {d.desc && <p className="mt-0.5 text-[12.5px] text-[#f5f4ee]/60">{d.desc}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Contribution libre ── */}
        {!vue?.cloturee && (
          <section className="mt-12 rounded-2xl border border-[#d97757]/30 bg-[#d97757]/[0.07] p-6 sm:p-8">
            <h2 className="text-xl font-bold">Soutenir le studio librement</h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#f5f4ee]/70">
              Vous souhaitez participer sans choisir un équipement particulier ? Votre contribution sera
              automatiquement affectée aux besoins prioritaires du studio.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[10, 25, 50, 100, 250].map((v) => (
                <a key={v} href={`/cagnotte?slug=studio-fonds&amount=${v}&retour=${encodeURIComponent('/studio-pedagogique')}`}
                  className="rounded-xl border border-[#d97757]/50 px-5 py-2.5 text-[14px] font-bold text-[#e8a184] transition-colors hover:bg-[#d97757] hover:text-[#1c1a18]">
                  {v} €
                </a>
              ))}
              <button type="button" onClick={() => setModal(fondsPseudo)}
                className="rounded-xl bg-[#d97757] px-5 py-2.5 text-[14px] font-bold text-[#1c1a18] transition-all hover:bg-[#e08b6d]">
                Montant libre
              </button>
            </div>
            {vue?.fondsCents > 0 && <p className="mt-3 text-[12.5px] text-[#f5f4ee]/55">{eur(vue.fondsCents)} déjà versés au fonds général.</p>}
          </section>
        )}

        {/* ── Transparence ── */}
        {vue && (
          <section className="mt-12">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#e8a184]" />
              <h2 className="text-xl font-bold">Où va votre contribution ?</h2>
            </div>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#f5f4ee]/70">
              Les fonds collectés sont exclusivement destinés à l'achat et à l'installation du matériel présenté
              sur cette page. Chaque contribution est enregistrée et rattachée à un équipement précis ou au fonds
              général du studio ; les achats réalisés sont documentés (date, prix payé, preuve).
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Budget total', eur(vue.objectifCents)],
                ['Montant collecté', eur(vue.collecteCents)],
                ['Montant dépensé', eur(vue.depenseCents)],
                ['Montant disponible', eur(vue.disponibleCents)],
                ['Équipements financés', String(vue.nbFinances)],
                ['Restent à financer', String(vue.nbRestants)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-[#2b2926] px-4 py-3">
                  <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-[#f5f4ee]/50">{k}</dt>
                  <dd className="mt-1 text-[18px] font-extrabold text-[#f5f4ee]">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* ── Mur des contributeurs ── */}
        {vue?.donateurs?.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#e8a184]" />
              <h2 className="text-xl font-bold">Merci à nos contributeurs</h2>
            </div>
            <p className="mt-1 text-[12.5px] text-[#f5f4ee]/50">Seuls les prénoms donnés volontairement apparaissent — les autres contributions restent anonymes.</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {vue.donateurs.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#2b2926] px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-bold text-[#f5f4ee]">{d.name}</span>
                    <span className="block truncate text-[11.5px] text-[#f5f4ee]/50">{d.equipement}</span>
                  </span>
                  <span className="shrink-0 text-[13.5px] font-extrabold text-[#e8a184]">
                    {d.displayCurrency && d.displayCurrency !== 'EUR' ? `${Number(d.displayAmount).toLocaleString('fr-FR')} ${d.displayCurrency}` : eur(d.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-16 border-t border-white/[0.07] pt-6 text-center text-[12px] text-[#f5f4ee]/40">
          <Sparkles className="mx-auto mb-2 h-4 w-4" />
          Studio pédagogique — cours en direct, formations, YouTube Live, TikTok Live, enregistrements et tableau numérique intelligent.
        </footer>
      </main>

      {modal && <ModalContribution equipement={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
