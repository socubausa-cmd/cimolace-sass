import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Crown,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  LayoutGrid,
  Plus,
  Minus,
  Search,
  Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import {
  MarketingAmbientLayers,
  PRORASCIENCE_MARKETING_HERO_CSS,
  easePremium,
} from '@/components/prorascience/prorascienceMarketingHeroBits';
import {
  CANONICAL_CYCLE_KEYS,
  CYCLE_MARKETING_CONTENT,
  CYCLE_SELECTOR_LABELS,
  INITIATION_GENERAL_FAQ,
  INITIATION_PRODUCT_NAME,
  normalizeCycleQueryParam,
} from '@/data/cycleInitiationProduct';

const COUNSELLOR_URL = '/appointment/request';

const FAQ_CYCLE_ICONS = {
  autonome: BookOpen,
  academique: GraduationCap,
  prive: HeartHandshake,
  privilegie: Crown,
};

const matchesSearch = (search, ...chunks) => {
  const s = String(search || '').trim().toLowerCase();
  if (!s) return true;
  return chunks.some((c) => String(c || '').toLowerCase().includes(s));
};

const FAQPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState(null);

  const selectedCycle = useMemo(() => normalizeCycleQueryParam(searchParams.get('cycle')), [searchParams]);

  const setSelectedCycle = (value) => {
    if (value === 'all') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ cycle: value }, { replace: true });
    }
    setOpenKey(null);
  };

  const segmentOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les niveaux', badge: 'Vue globale', icon: LayoutGrid },
      ...CANONICAL_CYCLE_KEYS.map((key) => ({
        value: key,
        label: CYCLE_SELECTOR_LABELS[key] || CYCLE_MARKETING_CONTENT[key].headline,
        badge: `Niv. ${CYCLE_MARKETING_CONTENT[key].tier}`,
        icon: FAQ_CYCLE_ICONS[key] || Sparkles,
      })),
    ],
    []
  );

  const cycleSections = useMemo(() => {
    const keys = selectedCycle === 'all' ? CANONICAL_CYCLE_KEYS : [selectedCycle];
    return keys
      .map((key) => {
        const c = CYCLE_MARKETING_CONTENT[key];
        const faq = (c.faq || []).filter((item) =>
          matchesSearch(search, item.q, item.a, c.headline, c.tagline, c.positioning)
        );
        return {
          key,
          headline: c.headline,
          tagline: c.tagline,
          tierBadge: c.tierBadge,
          tier: c.tier,
          faq,
        };
      })
      .filter((section) => section.faq.length > 0);
  }, [selectedCycle, search]);

  const generalFaq = useMemo(
    () => INITIATION_GENERAL_FAQ.filter((item) => matchesSearch(search, item.q, item.a, 'contrat', 'paiement')),
    [search]
  );

  const pageTitle =
    selectedCycle === 'all'
      ? `FAQ — ${INITIATION_PRODUCT_NAME}`
      : `FAQ — ${CYCLE_MARKETING_CONTENT[selectedCycle]?.headline || 'Initiation'}`;

  const toggle = (id) => {
    setOpenKey((k) => (k === id ? null : id));
  };

  return (
    <div className="prs-forfaits-site relative min-h-screen overflow-x-hidden bg-[#070b12] text-white">
      <style>{PRORASCIENCE_MARKETING_HERO_CSS}</style>
      <Helmet>
        <title>{pageTitle} | PRORASCIENCE</title>
      </Helmet>
      <MarketingAmbientLayers />

      <div className="relative z-[2] mx-auto max-w-4xl px-4 pb-24 pt-20 sm:px-6 md:pt-24 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easePremium }}
          className="text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--school-accent)]">
            {INITIATION_PRODUCT_NAME}
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">Questions fréquentes</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/65 md:text-base">
            Réponses alignées sur les quatre niveaux d&apos;accès à l&apos;initiation. Choisissez un niveau ou parcourez
            la vue globale.
          </p>
        </motion.div>

        <div className="relative mx-auto mt-10 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
          <Input
            type="search"
            placeholder="Filtrer les questions…"
            className="h-12 rounded-full border-white/15 bg-[#0c111d]/90 pl-12 text-white placeholder:text-white/40 focus-visible:ring-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpenKey(null);
            }}
          />
        </div>

        <div className="mt-8">
          <PremiumSegmentedSelector
            value={selectedCycle}
            onChange={setSelectedCycle}
            options={segmentOptions}
            layoutId="faq-initiation-cycle-pill"
            className="w-full max-w-none"
            showChevron={false}
          />
        </div>

        {selectedCycle !== 'all' && CYCLE_MARKETING_CONTENT[selectedCycle] ? (
          <Card className="premium-panel mt-8 border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-gradient-to-br from-[#1a2234]/95 to-[#0d121c]/95">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <BadgeTier tier={CYCLE_MARKETING_CONTENT[selectedCycle].tier} />
                <CardDescription className="text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]">
                  {CYCLE_MARKETING_CONTENT[selectedCycle].tierBadge}
                </CardDescription>
              </div>
              <CardTitle className="text-xl text-white md:text-2xl">
                {CYCLE_MARKETING_CONTENT[selectedCycle].headline}
              </CardTitle>
              <p className="text-sm leading-relaxed text-white/75">
                {CYCLE_MARKETING_CONTENT[selectedCycle].tagline}
              </p>
            </CardHeader>
          </Card>
        ) : null}

        <div className="mt-10 space-y-12">
          {cycleSections.length === 0 && search.trim() ? (
            <p className="text-center text-sm text-white/50">
              Aucune question ne correspond à « {search} » pour cette sélection.
            </p>
          ) : null}

          {selectedCycle === 'all'
            ? cycleSections.map((section) => (
                <section key={section.key}>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--school-accent)] md:text-xl">{section.headline}</h2>
                      <p className="text-sm text-white/55">{section.tagline}</p>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-white/40">Niveau {section.tier}</span>
                  </div>
                  <FaqAccordionList
                    items={section.faq}
                    idPrefix={`${section.key}-`}
                    openKey={openKey}
                    onToggle={toggle}
                  />
                </section>
              ))
            : cycleSections[0]?.faq?.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold text-white/90">Questions sur ce niveau</h2>
                  <FaqAccordionList
                    items={cycleSections[0].faq}
                    idPrefix={`${selectedCycle}-`}
                    openKey={openKey}
                    onToggle={toggle}
                  />
                </section>
              )}

          {generalFaq.length > 0 ? (
            <section>
              <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                <HelpCircle className="h-5 w-5 text-[var(--school-accent)]" />
                <h2 className="text-lg font-bold text-white md:text-xl">Contrats, paiement &amp; montée en gamme</h2>
              </div>
              <FaqAccordionList items={generalFaq} idPrefix="general-" openKey={openKey} onToggle={toggle} />
            </section>
          ) : null}
        </div>

        <Card className="premium-panel mt-14 border border-white/10 bg-[#151a21]/95">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-white">Besoin d&apos;une réponse personnalisée ?</p>
              <p className="mt-1 text-sm text-white/55">
                Comparez les niveaux sur la page forfaits ou prenez rendez-vous avec un conseiller.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                className="bg-[var(--school-accent)] font-bold text-black hover:bg-[#ebca5e]"
                asChild
              >
                <Link to="/forfaits">
                  Voir les forfaits
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/5" asChild>
                <Link to={COUNSELLOR_URL}>Rendez-vous conseiller</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function BadgeTier({ tier }) {
  return (
    <span className="rounded-full border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--school-accent)]">
      Niv. {tier}
    </span>
  );
}

function FaqAccordionList({ items, idPrefix, openKey, onToggle }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const id = `${idPrefix}${i}`;
        const isOpen = openKey === id;
        return (
          <div
            key={id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-[#151a21]/90 shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
          >
            <button
              type="button"
              onClick={() => onToggle(id)}
              className="flex w-full items-start justify-between gap-4 p-5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="font-semibold leading-snug text-white/95">{item.q}</span>
              {isOpen ? (
                <Minus className="mt-0.5 h-5 w-5 shrink-0 text-[var(--school-accent)]" aria-hidden />
              ) : (
                <Plus className="mt-0.5 h-5 w-5 shrink-0 text-white/40" aria-hidden />
              )}
            </button>
            {isOpen ? (
              <div className="border-t border-white/10 bg-black/20 px-5 py-4 text-sm leading-relaxed text-white/70">
                {item.a}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default FAQPage;
