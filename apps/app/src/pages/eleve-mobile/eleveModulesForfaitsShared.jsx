import React from 'react';
import {
  Activity,
  Atom,
  CalendarDays,
  Compass,
  Crown,
  Eye,
  Flame,
  Gem,
  Ghost,
  Globe,
  Heart,
  Leaf,
  Lock,
  MapPin,
  MessageSquare,
  Scale,
  Shield,
  Skull,
  Users,
  Waves,
  Wind,
} from 'lucide-react';
import { CANONICAL_CYCLE_KEYS } from '@/data/cycleInitiationProduct';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { EV_MUTED, EV_PAGE_AMBIENT } from '@/pages/eleve-mobile/eleveMobileScreensShared';

export const ELEV_MODULES_PAGE_AMBIENT = EV_PAGE_AMBIENT;

export const PRORASCIENCE_MODULES = [
  { number: 1, title: "Ontologie Sacrée", subtitle: "Origine de l'Être", description: "Comprendre l'origine de la réalité et les principes fondamentaux qui donnent naissance au monde." },
  { number: 2, title: "Cosmologie Prorascience", subtitle: "Structure de l'univers", description: "Découvrir la structure de l'univers et les relations entre espace, temps et énergie." },
  { number: 3, title: "Mécanique Vibratoire", subtitle: "Lois invisibles", description: "Comprendre les lois vibratoires qui influencent les événements et les situations." },
  { number: 4, title: "Science du Destin", subtitle: "Trajectoire de l'être", description: "Apprendre à comprendre les trajectoires de vie et les influences qui orientent le futur." },
  { number: 5, title: "Science de l'Incarnation", subtitle: "Vie, mort et continuité", description: "Étudier le cycle de la vie, de la mort et de la continuité de l'être." },
  { number: 6, title: "Science des Ancêtres", subtitle: "Mémoire de la lignée", description: "Comprendre l'influence de la lignée familiale et restaurer l'harmonie ancestrale." },
  { number: 7, title: "Science des Divinités", subtitle: "Forces cosmiques", description: "Explorer les grandes forces spirituelles et les archétypes des traditions africaines." },
  { number: 8, title: "Science des Esprits", subtitle: "Entités invisibles", description: "Comprendre les interactions entre les esprits et le monde humain." },
  { number: 9, title: "Science de la Divination", subtitle: "Lecture des signes", description: "Interpréter les signes, les rêves, les visions et les symboles." },
  { number: 10, title: "Science des Rituels", subtitle: "Action spirituelle", description: "Maîtriser les principes des rituels, invocations et pratiques sacrées." },
  { number: 11, title: "Science du Verbe Sacré", subtitle: "Pouvoir de la parole", description: "Découvrir le pouvoir de la parole, des bénédictions et des formules spirituelles." },
  { number: 12, title: "Science des Talismans", subtitle: "Objets de puissance", description: "Apprendre l'utilisation des objets de protection et de bénédiction." },
  { number: 13, title: "Science des Plantes Sacrées", subtitle: "Pharmacopée spirituelle", description: "Étudier les plantes médicinales et spirituelles des traditions africaines." },
  { number: 14, title: "Science de la Guérison Spirituelle", subtitle: "Réparation de l'être", description: "Apprendre les techniques de purification et de restauration énergétique." },
  { number: 15, title: "Science de la Protection Spirituelle", subtitle: "Défense spirituelle", description: "Se protéger des influences négatives et renforcer son équilibre." },
  { number: 16, title: "Science des Forces Occultes", subtitle: "Influences occultes", description: "Étudier les mécanismes des influences occultes et les moyens de s'en libérer." },
  { number: 17, title: "Sexualité Sacrée et Énergie Vitale", subtitle: "Pouvoir créateur", description: "Comprendre l'influence de l'énergie sexuelle sur la destinée et les relations." },
  { number: 18, title: "Science du Corps Spirituel", subtitle: "Centres énergétiques", description: "Explorer les états de conscience, la respiration rituelle et les pratiques corporelles." },
  { number: 19, title: "Science des Lieux Sacrés", subtitle: "Géographie spirituelle", description: "Reconnaître et activer les lieux de puissance." },
  { number: 20, title: "Science du Temps Sacré", subtitle: "Cycles spirituels", description: "Comprendre les cycles énergétiques et les périodes favorables aux actions spirituelles." },
  { number: 21, title: "Mayekou — Science de la Sagesse", subtitle: "Ordre social et harmonie", description: "Apprendre les principes d'équilibre, de justice et d'harmonie." },
];

export const MODULE_ICONS = [
  Atom,
  Globe,
  Waves,
  Compass,
  Heart,
  Users,
  Crown,
  Ghost,
  Eye,
  Flame,
  MessageSquare,
  Gem,
  Leaf,
  Activity,
  Shield,
  Skull,
  Lock,
  Wind,
  MapPin,
  CalendarDays,
  Scale,
];

export const CYCLE_FILTERS = [
  { id: 'all', label: 'Tous', short: '21' },
  { id: '1', label: 'Fondements', short: 'C1', modules: [1, 2, 3, 5] },
  { id: '2', label: 'Percevoir', short: 'C2', modules: [9, 6, 8, 7] },
  { id: '3', label: 'Agir', short: 'C3', modules: [10, 15, 14, 12] },
  { id: '4', label: 'Autorité', short: 'C4', modules: [4, 16, 17, 21] },
];

export const BILLING_INTERVALS = [
  { id: 'monthly', label: 'Mois' },
  { id: 'quarterly', label: 'Trimestre' },
  { id: 'yearly', label: 'Année' },
];

export function formatPrice(amount, currency) {
  const n = Number(amount || 0);
  const c = String(currency || 'XAF').toUpperCase();
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} ${c}`;
  }
}

function normalizeText(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export function findFormationForModule(formations, mod) {
  const byNum = formations.find((f) => Number(f?.meta?.catalog_number) === mod.number);
  if (byNum) return byNum;
  const target = normalizeText(mod.title);
  return (
    formations.find((f) => {
      const title = normalizeText(f?.title);
      return title === target || title.includes(target) || target.includes(title);
    }) || null
  );
}

export function formatInterval(v) {
  const x = String(v || '').toLowerCase();
  if (x === 'monthly') return 'Mensuel';
  if (x === 'quarterly') return 'Trimestriel';
  if (x === 'yearly') return 'Annuel';
  return '—';
}

export function toCycleKeyFromPlan(plan) {
  const slug = String(plan?.slug || '').toLowerCase().trim();
  const fromSlug = slug
    .replace(/-(monthly|quarterly|yearly|mensuel|trimestriel|annuel)$/i, '')
    .replace(/[^a-z0-9-]/g, '');
  if (fromSlug && CANONICAL_CYCLE_KEYS.includes(fromSlug)) return fromSlug;
  const match = CANONICAL_CYCLE_KEYS.find((k) => fromSlug.includes(k) || fromSlug.replace(/-/g, '') === k);
  return match || fromSlug || 'autonome';
}

export function PlanIntervalSegmented({ value, onChange }) {
  return (
    <div
      className="mb-4 flex rounded-[14px] border p-1"
      style={{
        borderColor: 'rgba(212, 175, 55, 0.22)',
        background: 'linear-gradient(180deg, rgba(26, 22, 16, 0.9) 0%, rgba(8, 8, 12, 0.95) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 12px -4px rgba(0,0,0,0.4)',
      }}
    >
      {BILLING_INTERVALS.map((it) => {
        const on = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={cn(
              'flex-1 rounded-[10px] py-2 text-center text-[11px] font-bold transition-all duration-200',
              on ? 'text-[#0b0b0f]' : 'text-white/40',
            )}
            style={
              on
                ? {
                    background: 'linear-gradient(180deg, #D4AF37 0%, #B8860B 100%)',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.2), 0 4px 14px -4px rgba(212, 175, 55, 0.5)',
                  }
                : undefined
            }
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function forfaitCardSurface() {
  return {
    background: [
      'radial-gradient(ellipse 90% 70% at 0% 0%, rgba(212, 175, 55, 0.12) 0%, transparent 55%)',
      'linear-gradient(190deg, rgba(26, 24, 20, 0.96) 0%, rgba(12, 12, 16, 0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(212, 175, 55, 0.22)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 18px -8px rgba(0,0,0,0.4)',
  };
}

export function moduleCatalogSurface(available) {
  return {
    background: [
      available
        ? 'radial-gradient(ellipse 110% 80% at 0% 0%, rgba(212, 175, 55, 0.13) 0%, transparent 55%)'
        : 'radial-gradient(ellipse 110% 80% at 0% 0%, rgba(148, 163, 184, 0.08) 0%, transparent 55%)',
      'linear-gradient(196deg, rgba(22, 24, 36, 0.97) 0%, rgba(9, 10, 16, 0.99) 100%)',
    ].join(', '),
    border: available ? '1px solid rgba(212, 175, 55, 0.24)' : '1px solid rgba(255, 255, 255, 0.09)',
    boxShadow: available
      ? 'inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 26px -16px rgba(212,175,55,0.35)'
      : 'inset 0 1px 0 rgba(255,255,255,0.05)',
  };
}

export { EV_MUTED };

export async function fetchPublishedFormationsForModules() {
  // Source réelle : table `courses` (la table `formations` n'existe pas dans ce tenant)
  const { data, error } = await supabase
    .from('courses')
    .select('id,title,description,category')
    .order('title', { ascending: true })
    .limit(40);
  if (error) return [];
  // Normalise vers la même forme attendue par findFormationForModule
  return (Array.isArray(data) ? data : []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    image_url: null,
    status: 'published',
    meta: { catalog_number: null, category: c.category },
    price: 0,
  }));
}

export async function fetchActiveBillingPlans() {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('id,slug,name,interval_type,price_amount,price_currency,active')
    .eq('active', true)
    .order('price_amount', { ascending: true });
  if (error || !Array.isArray(data) || data.length === 0) return [];
  return data.filter((p) => !String(p?.slug || '').toLowerCase().startsWith('ngowazulu-'));
}
