import React, { useState, useEffect, useCallback } from 'react';
import SEO from '@/components/SEO';
import { Link, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useBilling } from '@/contexts/BillingContext';
import { supabase } from '@/lib/customSupabaseClient';
import { getBillingCheckoutPath } from '@/lib/eleveBillingPath';
import { FORMATION_CATALOG_THUMBNAIL_URLS } from '@/data/formationCatalogModuleThumbnails';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import {
  Atom, Globe, Waves, Compass, Heart, Users,
  Crown, Ghost, Eye, Flame, MessageSquare, Gem,
  Leaf, Activity, Shield, Skull, Lock, Wind,
  MapPin, Clock, Scale, Sparkles, Star,
  BookOpen, MessageCircle, ChevronDown, GraduationCap,
  CalendarDays, UserCheck, Zap, ArrowRight, Check, X, Info,
  Loader2, CheckCircle2, LogIn, ChevronLeft, Menu, Home,
} from 'lucide-react';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SITE_NAME = `${isnaTenantConfig.branding.name} · LIRI`;

const moduleIcons = [Atom, Globe, Waves, Compass, Heart, Users, Crown, Ghost, Eye, Flame, MessageSquare, Gem, Leaf, Activity, Shield, Skull, Lock, Wind, MapPin, Clock, Scale];

/** Aligné `FORMATION_CATALOG_MODULES` (ordre 1–21) — vitrine mobile, grilles, etc. */
export const FORMATION_CATALOG_MODULE_ICONS = moduleIcons;

const moduleColors = [
  "violet", "blue", "cyan", "indigo", "rose", "amber", "yellow", "purple",
  "teal", "orange", "pink", "emerald", "lime", "green", "sky", "red",
  "fuchsia", "slate", "stone", "zinc", "yellow"
];

/** Même 21 titres / textes partout (catalogue web, vitrine mobile, etc.). */
const FORMATION_CATALOG_MODULES_BASE = [
  { number: 1, title: "Ontologie Sacrée", subtitle: "Origine de l'Être", description: "Comprendre l'origine de la réalité, la nature de l'existence et les principes fondamentaux qui donnent naissance au monde." },
  { number: 2, title: "Cosmologie Prorascience", subtitle: "Structure de l'univers", description: "Découvrir la structure de l'univers et les relations entre espace, temps et énergie." },
  { number: 3, title: "Mécanique Vibratoire", subtitle: "Lois invisibles", description: "Comprendre les lois vibratoires qui influencent les événements et les situations de la vie." },
  { number: 4, title: "Science du Destin", subtitle: "Trajectoire de l'être", description: "Apprendre à comprendre les trajectoires de vie, le karma et les influences qui orientent le futur." },
  { number: 5, title: "Science de l'Incarnation", subtitle: "Vie, mort et continuité", description: "Étudier le cycle de la vie, de la mort et de la continuité de l'être." },
  { number: 6, title: "Science des Ancêtres", subtitle: "Mémoire de la lignée", description: "Comprendre l'influence de la lignée familiale et restaurer l'harmonie ancestrale." },
  { number: 7, title: "Science des Divinités", subtitle: "Forces cosmiques", description: "Explorer les grandes forces spirituelles et les archétypes présents dans les traditions africaines." },
  { number: 8, title: "Science des Esprits", subtitle: "Entités invisibles", description: "Comprendre les interactions entre les esprits et le monde humain." },
  { number: 9, title: "Science de la Divination", subtitle: "Lecture des signes", description: "Apprendre à interpréter les signes, les rêves, les visions et les symboles." },
  { number: 10, title: "Science des Rituels", subtitle: "Action spirituelle", description: "Maîtriser les principes des rituels, des invocations et des pratiques sacrées." },
  { number: 11, title: "Science du Verbe Sacré", subtitle: "Pouvoir de la parole", description: "Découvrir le pouvoir de la parole, des bénédictions et des formules spirituelles." },
  { number: 12, title: "Science des Talismans", subtitle: "Objets de puissance", description: "Apprendre l'utilisation d'objets de protection et de bénédiction." },
  { number: 13, title: "Science des Plantes Sacrées", subtitle: "Pharmacopée spirituelle", description: "Étudier les plantes médicinales et spirituelles utilisées dans les traditions africaines." },
  { number: 14, title: "Science de la Guérison Spirituelle", subtitle: "Réparation de l'être", description: "Apprendre les techniques traditionnelles de purification et de restauration énergétique." },
  { number: 15, title: "Science de la Protection Spirituelle", subtitle: "Défense spirituelle", description: "Comprendre comment se protéger contre les influences négatives et renforcer son équilibre." },
  { number: 16, title: "Science des Forces Occultes", subtitle: "Influences occultes", description: "Étudier les mécanismes des influences occultes et les moyens de s'en libérer." },
  { number: 17, title: "Sexualité Sacrée et Énergie Vitale", subtitle: "Pouvoir créateur", description: "Comprendre l'influence de l'énergie sexuelle sur la destinée et les relations." },
  { number: 18, title: "Science du Corps Spirituel", subtitle: "Centres énergétiques", description: "Explorer les états de conscience, la respiration rituelle et les pratiques corporelles sacrées." },
  { number: 19, title: "Science des Lieux Sacrés", subtitle: "Géographie spirituelle", description: "Apprendre à reconnaître et à activer les lieux de puissance." },
  { number: 20, title: "Science du Temps Sacré", subtitle: "Cycles spirituels", description: "Comprendre les cycles énergétiques et les périodes favorables aux actions spirituelles." },
  { number: 21, title: "Mayekou — Science de la Sagesse", subtitle: "Ordre social et harmonie", description: "Apprendre les principes d'équilibre, de justice et d'harmonie dans la vie individuelle et communautaire." },
];

export const FORMATION_CATALOG_MODULES = FORMATION_CATALOG_MODULES_BASE.map((m, i) => ({
  ...m,
  thumbnail: FORMATION_CATALOG_THUMBNAIL_URLS[i] ?? null,
}));

const modules = FORMATION_CATALOG_MODULES;

const getColorClasses = (idx) => {
  const c = moduleColors[idx] || "yellow";
  if (c === "yellow" && idx === 20) {
    return { gradient: "from-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] to-yellow-900/10", border: "border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]", accent: "text-[var(--school-accent)]", bg: "bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]", badgeBg: "bg-[var(--school-accent)]" };
  }
  return {
    gradient: `from-${c}-500/20 to-${c}-900/10`,
    border: `border-${c}-500/30`,
    accent: `text-${c}-400`,
    bg: `bg-${c}-500/10`,
    badgeBg: `bg-${c}-500`,
  };
};

function normalizeText(t) {
  return String(t || '').toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, '').trim();
}

function findFormationForModule(formations, mod) {
  const byNum = formations.find(f => Number(f.meta?.catalog_number) === mod.number);
  if (byNum) return byNum;
  const normTarget = normalizeText(mod.title);
  return formations.find(f => {
    const n = normalizeText(f.title);
    return n === normTarget || n.includes(normTarget) || normTarget.includes(n);
  }) || null;
}

function resolveAccessModel(formation) {
  const meta = formation?.meta && typeof formation.meta === 'object' ? formation.meta : {};
  const mode = meta.access_mode || meta?.access?.mode || 'free';
  const planSlug = meta.billing_plan_slug || meta?.access?.billing_plan_slug || null;
  const standalonePriceRaw = meta.standalone_price ?? meta?.access?.standalone_price ?? formation?.price ?? null;
  const standalonePrice =
    standalonePriceRaw != null && standalonePriceRaw !== '' ? Number(standalonePriceRaw) : null;
  const standaloneCurrency = meta.standalone_currency || meta?.access?.standalone_currency || 'XAF';
  return { mode, planSlug, standalonePrice, standaloneCurrency };
}

const ModuleCard = ({
  mod,
  onOpenDetail,
  isAvailable,
  isEnrolled,
  enrolling,
  onEnroll,
  enrollSuccess,
  hasSubscriptionAccess,
  onSubscribe,
  onBuy,
  buyingFormationId,
}) => {
  const idx = mod.number - 1;
  const Icon = moduleIcons[idx] || Atom;
  const colors = getColorClasses(idx);
  const justEnrolled = enrollSuccess === mod.formation?.id;

  return (
    <div className={`group relative bg-gradient-to-br ${colors.gradient} border ${colors.border} rounded-2xl overflow-hidden transition-all duration-500 flex flex-col ${
      isAvailable ? 'hover:scale-[1.02] hover:shadow-2xl hover:shadow-black/30' : 'opacity-45 grayscale'
    }`}>
      {/* Availability badge */}
      {!isAvailable && (
        <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          À venir
        </div>
      )}
      {isEnrolled && (
        <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> {mod.access?.mode === 'one_time' ? 'Acheté' : 'Inscrit'}
        </div>
      )}

      {/* Header */}
      <div className="p-5 md:p-6 flex-1">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-11 h-11 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${colors.accent}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold ${colors.accent} uppercase tracking-wider`}>Module {mod.number}</span>
            </div>
            <h3 className="text-base md:text-lg font-serif font-bold text-white leading-tight">{mod.title}</h3>
            <p className={`text-sm ${colors.accent} font-medium mt-0.5`}>{mod.subtitle}</p>
          </div>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed mb-4">{mod.description}</p>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> 1 mois</span>
          <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> Coaching privé</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 md:px-6 py-4 border-t border-white/5 bg-white/[0.02] flex items-center justify-between gap-2">
        {isAvailable ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => onOpenDetail(mod)} className="text-gray-400 hover:text-white hover:bg-white/10 gap-1 text-sm">
              <Info className="w-3.5 h-3.5" /> Détails
            </Button>
            {mod.access?.mode === 'subscription' ? (
              hasSubscriptionAccess ? (
                <Link to={`/formation/${mod.formation?.id}/learn`}>
                  <Button size="sm" className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 gap-1.5 text-sm">
                    <BookOpen className="w-3.5 h-3.5" /> Accéder
                  </Button>
                </Link>
              ) : (
                <Button
                  size="sm"
                  className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold gap-1.5 text-sm"
                  onClick={onSubscribe}
                >
                  <Lock className="w-3.5 h-3.5" />
                  S'abonner
                </Button>
              )
            ) : mod.access?.mode === 'one_time' ? (
              isEnrolled ? (
                <Link to={`/formation/${mod.formation?.id}/learn`}>
                  <Button size="sm" className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 gap-1.5 text-sm">
                    <BookOpen className="w-3.5 h-3.5" /> Accéder
                  </Button>
                </Link>
              ) : (
                <Button
                  size="sm"
                  className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold gap-1.5 text-sm"
                  disabled={buyingFormationId === mod.formation?.id}
                  onClick={() => onBuy(mod)}
                >
                  {buyingFormationId === mod.formation?.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {buyingFormationId === mod.formation?.id ? 'Création…' : 'Acheter le module'}
                </Button>
              )
            ) : isEnrolled ? (
              <Link to={`/formation/${mod.formation?.id}/learn`}>
                <Button size="sm" className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 gap-1.5 text-sm">
                  <BookOpen className="w-3.5 h-3.5" /> Accéder
                </Button>
              </Link>
            ) : justEnrolled ? (
              <Link to="/eleve">
                <Button size="sm" className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-1.5 text-sm font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Inscrit !
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold gap-1.5 text-sm"
                disabled={enrolling === mod.formation?.id}
                onClick={() => onEnroll(mod.formation)}
              >
                {enrolling === mod.formation?.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                S'inscrire gratuitement
              </Button>
            )}
          </>
        ) : (
          <div className="w-full text-center text-xs text-gray-600 py-1">Module en cours de création</div>
        )}
      </div>
    </div>
  );
};

const ModuleDetailModal = ({
  mod,
  onClose,
  isAvailable,
  isEnrolled,
  enrolling,
  onEnroll,
  enrollSuccess,
  hasSubscriptionAccess,
  onSubscribe,
  onBuy,
  buyingFormationId,
}) => {
  if (!mod) return null;
  const idx = mod.number - 1;
  const Icon = moduleIcons[idx] || Atom;
  const colors = getColorClasses(idx);
  const justEnrolled = enrollSuccess === mod.formation?.id;

  const includes = [
    { icon: UserCheck, text: "Enseignement personnalisé en face-à-face" },
    { icon: MessageCircle, text: "Séances de coaching privé hebdomadaires" },
    { icon: Zap, text: "Pratiques guidées et exercices initiatiques" },
    { icon: Eye, text: "Suivi individuel tout au long du mois" },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0F1419] border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className={`bg-gradient-to-br ${colors.gradient} p-8 md:p-10 border-b border-white/10`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-14 h-14 rounded-2xl ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
              <Icon className={`w-7 h-7 ${colors.accent}`} />
            </div>
            <div>
              <span className={`text-xs font-bold ${colors.accent} uppercase tracking-wider`}>Module {mod.number}</span>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-white leading-tight">{mod.title}</h2>
              <p className={`text-sm ${colors.accent} font-medium mt-0.5`}>{mod.subtitle}</p>
            </div>
          </div>
          <p className="text-gray-300 text-base leading-relaxed">{mod.description}</p>
        </div>
        <div className="p-8 md:p-10 space-y-8">
          <div>
            <h3 className="text-lg font-serif font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--school-accent)]" /> Ce que comprend ce module
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {includes.map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/[0.03] border border-white/5 rounded-xl p-4">
                  <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-[var(--school-accent)]" />
                  </div>
                  <span className="text-sm text-gray-300 font-medium leading-relaxed">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 text-center">
              <CalendarDays className="w-6 h-6 text-[var(--school-accent)] mx-auto mb-2" />
              <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Durée</div>
              <div className="text-xl font-bold text-white">1 mois</div>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 text-center">
              <Star className="w-6 h-6 text-[var(--school-accent)] mx-auto mb-2" />
              <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Disponibilité</div>
              <div className={`text-xl font-bold ${isAvailable ? 'text-green-400' : 'text-gray-500'}`}>
                {isAvailable ? 'Disponible' : 'À venir'}
              </div>
            </div>
          </div>
          <div className={`bg-gradient-to-br ${colors.gradient} border ${colors.border} rounded-2xl p-6 text-center`}>
            {isAvailable ? (
              <>
                <div className="text-sm text-green-400 font-bold uppercase tracking-wider mb-1">✓ Module disponible</div>
                <div className="text-4xl md:text-5xl font-bold text-[var(--school-accent)] mb-1">
                  {mod.access?.mode === 'subscription'
                    ? 'Abonnement'
                    : mod.access?.mode === 'one_time'
                      ? `${mod.access?.standalonePrice ?? '--'} ${mod.access?.standaloneCurrency || 'XAF'}`
                      : 'Gratuit'}
                </div>
                <div className="text-sm text-gray-500 mb-6">
                  {mod.access?.mode === 'subscription'
                    ? 'Accès via forfait actif'
                    : mod.access?.mode === 'one_time'
                      ? 'Achat individuel requis'
                      : 'Inscription instantanée — accès immédiat'}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {mod.access?.mode === 'subscription' ? (
                    hasSubscriptionAccess ? (
                      <Link to={`/formation/${mod.formation?.id}/learn`}>
                        <Button className="bg-green-500 text-white hover:bg-green-600 gap-2 h-12 px-8 text-base font-bold w-full sm:w-auto">
                          <BookOpen className="w-5 h-5" /> Accéder au cours
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2 h-12 px-8 text-base font-bold w-full sm:w-auto"
                        onClick={onSubscribe}
                      >
                        <Lock className="w-5 h-5" /> Voir les forfaits
                      </Button>
                    )
                  ) : mod.access?.mode === 'one_time' ? (
                    isEnrolled || justEnrolled ? (
                      <Link to={`/formation/${mod.formation?.id}/learn`}>
                        <Button className="bg-green-500 text-white hover:bg-green-600 gap-2 h-12 px-8 text-base font-bold w-full sm:w-auto">
                          <BookOpen className="w-5 h-5" /> Accéder au cours
                        </Button>
                      </Link>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                          className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2 h-12 px-6 text-base font-bold"
                          disabled={buyingFormationId === mod.formation?.id}
                          onClick={() => onBuy(mod, 'mobile_money')}
                        >
                          {buyingFormationId === mod.formation?.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />} Mobile Money
                        </Button>
                        <Button
                          variant="outline"
                          className="border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] gap-2 h-12 px-6 text-base font-bold"
                          disabled={buyingFormationId === mod.formation?.id}
                          onClick={() => onBuy(mod, 'monero')}
                        >
                          <Zap className="w-5 h-5" /> Monero
                        </Button>
                        <Button
                          variant="outline"
                          className="border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] gap-2 h-12 px-6 text-base font-bold"
                          disabled={buyingFormationId === mod.formation?.id}
                          onClick={() => onBuy(mod, 'chariow')}
                        >
                          <Zap className="w-5 h-5" /> Chariow
                        </Button>
                        <Button
                          variant="outline"
                          className="border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] gap-2 h-12 px-6 text-base font-bold"
                          disabled={buyingFormationId === mod.formation?.id}
                          onClick={() => onBuy(mod, 'paypal')}
                        >
                          <Zap className="w-5 h-5" /> PayPal
                        </Button>
                      </div>
                    )
                  ) : isEnrolled || justEnrolled ? (
                    <Link to={`/formation/${mod.formation?.id}/learn`}>
                      <Button className="bg-green-500 text-white hover:bg-green-600 gap-2 h-12 px-8 text-base font-bold w-full sm:w-auto">
                        <BookOpen className="w-5 h-5" /> Accéder au cours
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2 h-12 px-8 text-base font-bold w-full sm:w-auto"
                      disabled={enrolling === mod.formation?.id}
                      onClick={() => onEnroll(mod.formation)}
                    >
                      {enrolling === mod.formation?.id
                        ? <><Loader2 className="w-5 h-5 animate-spin" /> Inscription…</>
                        : <><Zap className="w-5 h-5" /> S'inscrire gratuitement</>}
                    </Button>
                  )}
                  <Button variant="outline" onClick={onClose} className="border-white/20 hover:bg-white/5 text-white h-12 px-6">
                    Retour
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-500 uppercase tracking-wider font-bold mb-3">Module en cours de création</div>
                <p className="text-gray-400 text-sm mb-4">Ce module sera bientôt disponible. Inscris-toi à un autre module pour commencer ton parcours.</p>
                <Button variant="outline" onClick={onClose} className="border-white/20 hover:bg-white/5 text-white h-12 px-6">
                  Voir les modules disponibles
                </Button>
              </>
            )}
          </div>
          <p className="text-center text-xs text-gray-600">
            Les modules peuvent être suivis indépendamment ou dans un parcours complet de 21 mois.
          </p>
        </div>
      </div>
    </div>
  );
};

const FormationCatalogPage = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedModule, setSelectedModule] = useState(null);
  const [publishedFormations, setPublishedFormations] = useState([]);
  const [loadingFormations, setLoadingFormations] = useState(true);
  const [enrollments, setEnrollments] = useState({});
  const [enrolling, setEnrolling] = useState(null);
  const [enrollSuccess, setEnrollSuccess] = useState(null);
  const [enrollError, setEnrollError] = useState(null);
  const [buyingFormationId, setBuyingFormationId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, session } = useAuth();
  const { status: billingStatus, inGrace } = useBilling();
  const navigate = useNavigate();
  const shouldUseNativeMobileCatalog =
    typeof window !== 'undefined' &&
    (Capacitor.isNativePlatform() ||
      (window.matchMedia?.('(max-width: 767px)').matches ?? window.innerWidth < 768));
  const hasSubscriptionAccess = billingStatus === 'active' || (billingStatus === 'past_due' && inGrace);

  useEffect(() => {
    if (!shouldUseNativeMobileCatalog) return;
    navigate(ELEVE_MOBILE.modules, { replace: true });
  }, [navigate, shouldUseNativeMobileCatalog]);

  useEffect(() => {
    supabase
      .from('courses')
      .select('id, title, description, status, cycle, meta, image_url, price_cents')
      .eq('status', 'published')
      .then(({ data }) => {
        setPublishedFormations(data || []);
        setLoadingFormations(false);
      });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('student_progress')
      .select('course_id, status')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(e => { map[e.course_id] = e; });
        setEnrollments(map);
      });
  }, [user]);

  const handleEnroll = useCallback(async (formation) => {
    if (!formation?.id) return;
    if (!user?.id) {
      navigate('/login', { state: { from: { pathname: '/formations/catalogue' } } });
      return;
    }
    setEnrollError(null);
    setEnrolling(formation.id);
    const { error } = await supabase.from('student_progress').insert({
      user_id: user.id,
      course_id: formation.id,
      status: 'active',
    });
    setEnrolling(null);
    if (!error || error.code === '23505') {
      setEnrollments(prev => ({ ...prev, [formation.id]: { formation_id: formation.id, status: 'active' } }));
      setEnrollSuccess(formation.id);
      setTimeout(() => navigate('/eleve'), 1800);
    } else {
      setEnrollError(error.message);
    }
  }, [user, navigate]);

  const handleBuyModule = useCallback(async (mod, paymentMethod = 'mobile_money') => {
    const formation = mod?.formation;
    if (!formation?.id) return;
    if (!user?.id || !session?.access_token) {
      navigate('/login', { state: { from: { pathname: '/formations/catalogue' } } });
      return;
    }
    setEnrollError(null);
    setBuyingFormationId(formation.id);
    try {
      const res = await fetch('/.netlify/functions/billing-create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          formationId: formation.id,
          paymentMethod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur création paiement');
      const paymentId = data?.payment?.id;
      if (!paymentId) throw new Error('Paiement créé mais identifiant manquant');
      navigate(getBillingCheckoutPath(paymentId));
    } catch (e) {
      setEnrollError(e?.message || 'Erreur paiement module');
    } finally {
      setBuyingFormationId(null);
    }
  }, [navigate, session?.access_token, user?.id]);

  const moduleCards = modules.map(mod => {
    const formation = findFormationForModule(publishedFormations, mod);
    return {
      ...mod,
      formation,
      access: resolveAccessModel(formation),
      available: !!formation,
      enrolled: formation ? !!enrollments[formation.id] : false,
    };
  });

  const cycleMap = {
    '1': [1, 2, 3, 5],
    '2': [9, 6, 8, 7],
    '3': [10, 15, 14, 12],
    '4': [4, 16, 17, 21],
  };

  const availableCount = moduleCards.filter(m => m.available).length;

  const filteredCards = activeFilter === 'all'
    ? moduleCards
    : moduleCards.filter(m => cycleMap[activeFilter]?.includes(m.number));

  const includes = [
    "Enseignement personnalisé",
    "Séances de coaching privé",
    "Pratiques guidées",
    "Suivi individuel",
  ];

  if (shouldUseNativeMobileCatalog) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0B0B0F] text-white">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <LiriWordmark size="compact" className="text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]" />
          <p className="text-[12px]">Ouverture du catalogue mobile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pb-24 md:pb-0">
      <SEO
        title="Les 21 Modules de Formation"
        description={`21 modules de coaching initiatique privé — ${SITE_NAME}. Formation personnalisée en Sciences Nocturnes Africaines par le 5ᵉ Manikongo.`}
      />

      {/* Coque mobile — LIRI + titre + menu (équivalent maquette app) */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0F1419]/95 backdrop-blur-md md:hidden">
        <div
          className="flex h-[52px] items-center justify-between gap-2 px-3"
          style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top, 0px))' }}
        >
          <Link
            to="/forfaits"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition active:bg-white/10"
            aria-label="Retour"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <LiriWordmark size="compact" className="shrink-0 text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]" />
            <span className="truncate text-center text-[15px] font-semibold tracking-tight text-white">Formations</span>
          </div>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition active:bg-white/10"
                aria-label="Menu"
              >
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(100%,20rem)] border-white/10 bg-[#0b0f14]/98">
              <SheetHeader>
                <SheetTitle className="text-left text-white">Navigation</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1 text-[15px]">
                {[
                  { to: '/', label: 'Accueil', icon: Home },
                  { to: '/forfaits', label: 'Forfaits & cycles', icon: Star },
                  { to: '/formations/catalogue', label: 'Formations (21 modules)', icon: GraduationCap, current: true },
                  { to: '/ecoles', label: 'Les 21 Sciences', icon: BookOpen },
                  { to: '/appointment/request', label: 'Rendez-vous conseiller', icon: MessageCircle },
                  { to: user ? '/dashboard' : '/login', label: user ? 'Mon espace' : 'Connexion', icon: LogIn },
                ].map(({ to, label, icon: Icon, current }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                      current
                        ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)]'
                        : 'text-white/80 hover:bg-white/[0.06]'
                    }`}
                  >
                    {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-90" /> : null}
                    {label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden px-4 py-10 sm:px-6 md:px-6 md:py-28 lg:py-36">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#192734]/60 to-[#0F1419]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[200px]" />

        <div className="relative mx-auto max-w-4xl space-y-5 text-center sm:space-y-6">
          <span className="inline-flex max-w-[95vw] items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-4 py-2 text-[10px] font-bold uppercase leading-snug tracking-widest text-[var(--school-accent)] sm:px-5 sm:text-xs">
            <GraduationCap className="h-4 w-4 shrink-0" /> Coaching initiatique privé
          </span>

          <h1 className="font-serif text-3xl font-bold leading-[1.12] text-white sm:text-4xl md:text-6xl lg:text-7xl">
            Les 21 Modules de<br />
            <span className="bg-gradient-to-r from-[var(--school-accent)] via-yellow-400 to-[var(--school-accent)] bg-clip-text text-transparent">
              Formation Prorascience
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-base leading-relaxed text-gray-400 md:text-xl">
            L'école Ngowazulu propose un parcours unique d\'apprentissage. Chaque module est en
            <span className="text-[var(--school-accent)] font-semibold"> coaching privé personnalisé</span>, avec un enseignement direct adapté à votre situation.
          </p>

          <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent mx-auto" />

          <ChevronDown className="w-6 h-6 text-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] mx-auto animate-bounce" />
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-20 space-y-16">

        {/* CE QUE COMPREND CHAQUE MODULE */}
        <section className="bg-gradient-to-br from-[#192734] to-[#0f1216] rounded-3xl p-8 md:p-12 border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <Sparkles className="w-8 h-8 text-[var(--school-accent)] mb-4" />
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-4">
                  Formation Premium Personnalisée
                </h2>
                <p className="text-gray-400 text-base leading-relaxed mb-6">
                  Chaque module dure <span className="text-white font-semibold">1 mois</span> et comprend un accompagnement complet en coaching privé. Les modules peuvent être suivis indépendamment ou dans un parcours complet.
                </p>
                <ul className="space-y-3">
                  {includes.map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 text-[var(--school-accent)]" />
                      </div>
                      <span className="text-sm text-gray-300 font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-center text-center bg-white/[0.03] border border-white/10 rounded-2xl p-8">
                <div className="text-sm text-gray-500 uppercase tracking-wider font-bold mb-2">Accès instantané</div>
                <div className="text-5xl md:text-6xl font-bold text-[var(--school-accent)] mb-1">Gratuit</div>
                <div className="text-sm text-gray-500 mb-4">Inscription en un clic</div>
                <div className="w-16 h-0.5 bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] mx-auto mb-4" />
                {loadingFormations ? (
                  <div className="text-xs text-gray-600 mb-6 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Chargement…</div>
                ) : (
                  <div className="text-xs text-gray-400 mb-6">
                    <span className="text-green-400 font-bold">{availableCount}</span> module{availableCount !== 1 ? 's' : ''} disponible{availableCount !== 1 ? 's' : ''} sur 21
                  </div>
                )}
                <Link to="/login" state={{ from: { pathname: '/formations/catalogue' } }}>
                  <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2 h-12 px-8 text-base font-bold">
                    <LogIn className="w-5 h-5" /> Accéder aux cours
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FILTRE + GRILLE DES 21 MODULES */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-3">
              Catalogue des 21 Modules
            </h2>
            <p className="text-gray-400 text-base max-w-xl mx-auto mb-6">
              Choisissez un module individuel ou suivez un cycle complet.
            </p>
            <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:justify-center md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium transition-all sm:px-4 sm:text-sm ${
                  activeFilter === 'all' ? 'bg-[var(--school-accent)] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Tous (21)
              </button>
              {[
                { key: '1', label: 'Cycle 1 — Fondements' },
                { key: '2', label: 'Cycle 2 — Percevoir' },
                { key: '3', label: 'Cycle 3 — Agir' },
                { key: '4', label: 'Cycle 4 — Autorité' },
              ].map(c => (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => setActiveFilter(c.key)}
                  className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium transition-all sm:px-4 sm:text-sm ${
                    activeFilter === c.key ? 'bg-[var(--school-accent)] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {loadingFormations ? (
            <div className="flex justify-center items-center py-20 gap-3 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--school-accent)]" />
              Chargement des modules…
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-7">
              {filteredCards.map((mod) => (
                <ModuleCard
                  key={mod.number}
                  mod={mod}
                  onOpenDetail={setSelectedModule}
                  isAvailable={mod.available}
                  isEnrolled={mod.enrolled}
                  enrolling={enrolling}
                  onEnroll={handleEnroll}
                  enrollSuccess={enrollSuccess}
                  hasSubscriptionAccess={hasSubscriptionAccess}
                  onSubscribe={() => navigate('/forfaits')}
                  onBuy={(m, method) => handleBuyModule(m, method || 'mobile_money')}
                  buyingFormationId={buyingFormationId}
                />
              ))}
            </div>
          )}
        </section>

        {/* PARCOURS COMPLET */}
        <section className="bg-gradient-to-br from-[var(--school-accent)]/[0.08] to-transparent border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
          <div className="relative text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)] text-xs font-bold uppercase tracking-widest border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] mb-4">
              <Star className="w-4 h-4" /> Parcours intégral
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-3">
              Parcours Complet Prorascience
            </h2>
            <p className="text-gray-400 text-base max-w-xl mx-auto mb-6">
              Formation complète de <span className="text-white font-semibold">21 mois</span> destinée à ceux qui souhaitent maîtriser l'ensemble des sciences de la Prorascience.
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[var(--school-accent)]">21</div>
                <div className="text-xs text-gray-500">Modules</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[var(--school-accent)]">21</div>
                <div className="text-xs text-gray-500">Mois</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-[var(--school-accent)]">4</div>
                <div className="text-xs text-gray-500">Cycles</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button className="h-12 gap-2 bg-[var(--school-accent)] px-8 text-lg font-bold text-black hover:bg-yellow-500" asChild>
                <Link to="/appointment/request">
                  <MessageCircle className="w-5 h-5" /> Discuter du parcours complet
                </Link>
              </Button>
              <Link to="/ecoles">
                <Button variant="outline" className="border-white/20 hover:bg-white/5 text-white h-12 px-8 text-lg">
                  <BookOpen className="w-5 h-5 mr-2" /> Voir les 21 Sciences
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <div className="text-center py-4 border-t border-white/5">
          <p className="text-sm text-gray-600">
            © Prorascience — Coaching initiatique privé — École Ngowazulu — Système MK5
          </p>
        </div>
      </div>

      {/* MODAL */}
      {enrollError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-red-900/90 border border-red-500/40 text-red-200 px-6 py-3 rounded-2xl text-sm shadow-2xl">
          Erreur inscription : {enrollError}
        </div>
      )}

      <Link
        to="/appointment/request"
        className="fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--school-accent)] text-black shadow-lg shadow-black/50 ring-2 ring-black/30 transition active:scale-95 md:hidden"
        style={{ marginBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
        aria-label="Rendez-vous ou message"
      >
        <MessageCircle className="h-7 w-7" strokeWidth={2} />
      </Link>

      {selectedModule && (
        <ModuleDetailModal
          mod={selectedModule}
          onClose={() => setSelectedModule(null)}
          isAvailable={selectedModule.available}
          isEnrolled={selectedModule.enrolled}
          enrolling={enrolling}
          onEnroll={handleEnroll}
          enrollSuccess={enrollSuccess}
          hasSubscriptionAccess={hasSubscriptionAccess}
          onSubscribe={() => navigate('/forfaits')}
          onBuy={(m, method) => handleBuyModule(m, method || 'mobile_money')}
          buyingFormationId={buyingFormationId}
        />
      )}
    </div>
  );
};

export default FormationCatalogPage;
