import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, BadgeCheck, Users, ShieldCheck, Camera } from 'lucide-react';
import { cagnotteApi } from '@/lib/api-v2';
import { eur, Progression, ModalContribution } from '@/pages/StudioCagnottePage';

/**
 * StudioEquipementPage — /studio-pedagogique/:slug : la FICHE PORTFOLIO d'un
 * équipement de la campagne studio. Page partageable : galerie, présentation
 * longue, utilité pédagogique, progression réelle, contribution, contributeurs
 * de CET équipement, achat documenté. Données : même overview public que la
 * liste + mur des donateurs de la campagne de l'équipement.
 */

export default function StudioEquipementPage() {
  const { slug } = useParams();
  const [vue, setVue] = useState(null);
  const [donateurs, setDonateurs] = useState([]);
  const [erreur, setErreur] = useState('');
  const [modal, setModal] = useState(null);
  const [imageActive, setImageActive] = useState(0);

  useEffect(() => {
    cagnotteApi.studioOverview()
      .then(setVue)
      .catch(() => setErreur('Impossible de charger la fiche pour le moment — réessayez dans un instant.'));
  }, []);
  useEffect(() => {
    if (!slug) return;
    cagnotteApi.donors(slug).then((l) => Array.isArray(l) && setDonateurs(l)).catch(() => {});
  }, [slug]);

  const e = useMemo(() => vue?.equipements?.find((x) => x.slug === slug) || null, [vue, slug]);
  const galerie = useMemo(() => {
    if (!e) return [];
    const liste = (e.images?.length ? e.images : [e.image]).filter(Boolean);
    return [...new Set(liste)];
  }, [e]);

  useEffect(() => { setImageActive(0); }, [slug]);

  if (erreur || (vue && !e)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#262624] px-6 text-center text-[#f5f4ee]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div>
          <p className="text-[15px] font-semibold">{erreur || 'Cet équipement ne fait pas (ou plus) partie de la campagne.'}</p>
          <a href="/studio-pedagogique" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#d97757] px-5 py-2.5 text-[14px] font-bold text-[#1c1a18]">
            <ArrowLeft className="h-4 w-4" /> Retour à la campagne
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#262624] text-[#f5f4ee]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-8">
        <a href="/studio-pedagogique" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#f5f4ee]/60 transition-colors hover:text-[#e8a184]">
          <ArrowLeft className="h-4 w-4" /> Campagne du studio pédagogique
        </a>

        {!e ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-2" aria-label="Chargement de la fiche">
            <div className="aspect-[4/3] animate-pulse rounded-2xl bg-white/[0.05]" />
            <div className="space-y-4"><div className="h-10 w-3/4 animate-pulse rounded-lg bg-white/[0.05]" /><div className="h-28 animate-pulse rounded-lg bg-white/[0.04]" /><div className="h-24 animate-pulse rounded-lg bg-white/[0.04]" /></div>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              {/* ── Galerie ── */}
              <div>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#f2efe9]">
                  {galerie[imageActive] ? (
                    <img src={galerie[imageActive]} alt={`${e.label} — visuel ${imageActive + 1}`} className="h-full w-full object-contain p-5" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[#262624]/25"><Camera className="h-12 w-12" /></div>
                  )}
                  {e.finance && (
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#7fb98a] px-3 py-1 text-[12px] font-bold text-[#14281a]">
                      <Check className="h-3.5 w-3.5" /> Financé
                    </span>
                  )}
                </div>
                {galerie.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Visuels de l'équipement">
                    {galerie.map((src, i) => (
                      <button key={src} type="button" role="tab" aria-selected={i === imageActive} onClick={() => setImageActive(i)}
                        className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border bg-[#f2efe9] transition-colors ${i === imageActive ? 'border-[#d97757]' : 'border-white/10 opacity-70 hover:opacity-100'}`}>
                        <img src={src} alt="" className="h-full w-full object-contain p-1" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Résumé + contribution ── */}
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-extrabold leading-tight tracking-tight" style={{ textWrap: 'balance' }}>{e.label}</h1>
                  <span className="rounded-lg border border-white/10 px-2.5 py-1 text-[15px] font-bold text-[#f5f4ee]/85">{e.prixEur.toLocaleString('fr-FR')} €</span>
                </div>
                {e.desc && <p className="mt-2 text-[15px] font-semibold text-[#e8a184]">{e.desc}</p>}

                <div className="mt-5 rounded-2xl border border-white/10 bg-[#2b2926] p-5">
                  <div className="mb-2 flex items-baseline justify-between text-[13.5px]">
                    <span className="font-semibold text-[#f5f4ee]/80">{eur(e.collecteCents)} / {eur(e.objectifCents)} financés</span>
                    <span className="font-bold text-[#e8a184]">{e.pct} %</span>
                  </div>
                  <Progression pct={e.pct} />
                  {e.finance ? (
                    <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#7fb98a]/40 bg-[#7fb98a]/10 py-3 text-[14px] font-bold text-[#a9d4b0]">
                      <Check className="h-4 w-4" /> Équipement financé — merci !
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-2">
                      <button type="button" onClick={() => !vue.cloturee && setModal(e)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] py-3 text-[14.5px] font-bold text-[#1c1a18] transition-all hover:bg-[#e08b6d]">
                        Participer à cet équipement <ArrowRight className="h-4 w-4" />
                      </button>
                      {e.restantCents > 0 && (
                        <button type="button" onClick={() => !vue.cloturee && setModal({ ...e, presetReste: true })}
                          className="w-full rounded-xl border border-[#d97757]/50 py-2.5 text-[13px] font-bold text-[#e8a184] transition-colors hover:bg-[#d97757]/10">
                          Financer les {Math.ceil(e.restantCents / 100)} € restants
                        </button>
                      )}
                    </div>
                  )}
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-[#f5f4ee]/45">
                    <ShieldCheck className="h-3.5 w-3.5" /> Paiement sécurisé — carte ou Mobile Money · chaque contribution est enregistrée sur cet équipement.
                  </p>
                </div>

                {e.achete?.date && (
                  <div className="mt-4 rounded-2xl border border-[#7fb98a]/30 bg-[#7fb98a]/[0.05] p-4">
                    <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#a9d4b0]"><BadgeCheck className="h-4 w-4" /> Acheté grâce à vos contributions</p>
                    <p className="mt-1 text-[12.5px] text-[#f5f4ee]/70">
                      Le {e.achete.date}{e.achete.prixPayeEur ? ` · ${e.achete.prixPayeEur.toLocaleString('fr-FR')} € payés` : ''}
                      {e.achete.installe ? ' · installé dans le studio' : ''}
                      {e.achete.facture && <> · <a className="font-semibold text-[#e8a184] hover:underline" href={e.achete.facture} target="_blank" rel="noreferrer">preuve d'achat</a></>}
                    </p>
                    {e.achete.photo && <img src={e.achete.photo} alt={`${e.label} — acheté`} className="mt-3 max-h-44 rounded-lg" />}
                  </div>
                )}
              </div>
            </div>

            {/* ── Utilité + présentation longue ── */}
            <section className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#d97757]/25 bg-[#d97757]/[0.06] p-6">
                <h2 className="text-lg font-bold">À quoi servira-t-il dans le studio ?</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-[#f5f4ee]/80">{e.utilite || e.desc}</p>
              </div>
              {e.presentation && (
                <div className="rounded-2xl border border-white/10 bg-[#2b2926] p-6">
                  <h2 className="text-lg font-bold">Présentation</h2>
                  {e.presentation.split(/\n+/).map((p, i) => (
                    <p key={i} className="mt-2 text-[14px] leading-relaxed text-[#f5f4ee]/75">{p}</p>
                  ))}
                </div>
              )}
            </section>

            {/* ── Contributeurs de cet équipement ── */}
            {donateurs.length > 0 && (
              <section className="mt-10">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#e8a184]" />
                  <h2 className="text-lg font-bold">Ils ont contribué à cet équipement</h2>
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {donateurs.map((d, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#2b2926] px-4 py-2.5">
                      <span className="truncate text-[13.5px] font-bold text-[#f5f4ee]">{d.name}</span>
                      <span className="shrink-0 text-[13.5px] font-extrabold text-[#e8a184]">
                        {d.displayCurrency && d.displayCurrency !== 'EUR' ? `${Number(d.displayAmount).toLocaleString('fr-FR')} ${d.displayCurrency}` : eur(d.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="mt-12 text-center">
              <a href="/studio-pedagogique" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#e8a184] hover:underline">
                <ArrowLeft className="h-4 w-4" /> Voir tous les équipements de la campagne
              </a>
            </p>
          </>
        )}
      </div>

      {modal && <ModalContribution equipement={modal} onClose={() => setModal(null)} retour={`/studio-pedagogique/${slug}`} />}
    </div>
  );
}
