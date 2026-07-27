import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { TENANT_SLUG } from '@/lib/liri-api';
import { supabase } from '@/lib/supabase';

/**
 * Rôle et MOTEURS ACTIVÉS du tenant — la base du sélecteur de moteur natif.
 *
 * Le portail web construit son rail à partir de deux informations : le rôle de
 * l'utilisateur (créateur ou élève) et les services souscrits par le tenant
 * (`tenant_services`). L'app native ne lisait ni l'un ni l'autre : elle servait
 * les mêmes six onglets à tout le monde, qu'un moteur soit acheté ou non.
 *
 * ⚠️ `tenant_services` est protégé par RLS (membre actif). Une requête lancée
 * avant que la session soit prête revient VIDE — la conclure en « aucun service »
 * fige les moteurs masqués. On ne retient donc qu'une réponse NON VIDE, et on
 * retente sinon (même garde-fou que `useSchoolActive` côté web).
 */

const CREATOR_ROLES = ['owner', 'admin', 'creator', 'teacher', 'secretariat'];

/** Les clés `tenant_services` qui allument le moteur École. Le vocabulaire a
 *  bougé au fil des migrations (seed ISNA `school_engine`, plans LIRI
 *  `course_builder`), d'où plusieurs clés acceptées plutôt qu'une seule. */
const SCHOOL_KEYS = ['school', 'school_engine', 'course_builder'];
const SHOP_KEYS = ['pay_engine', 'cinetpay', 'mbolo', 'stripe_connect'];
const HEALTH_KEYS = ['med_ehr', 'med_notes', 'med_programs'];

type TenantValue = {
  ready: boolean;
  role: string | null;
  isCreator: boolean;
  services: string[];
  hasAny: (keys: string[]) => boolean;
  schoolActive: boolean;
  shopActive: boolean;
  healthActive: boolean;
};

const EMPTY: TenantValue = {
  ready: false, role: null, isCreator: false, services: [],
  hasAny: () => false, schoolActive: false, shopActive: false, healthActive: false,
};

const TenantContext = createContext<TenantValue>(EMPTY);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  const [services, setServices] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const attempt = async () => {
      if (!alive) return;
      const [{ data: membership }, { data: rows }] = await Promise.all([
        supabase
          .from('tenant_memberships')
          .select('role,tenants!inner(slug)')
          .eq('status', 'active')
          .eq('tenants.slug', TENANT_SLUG)
          .maybeSingle(),
        supabase.from('tenant_services').select('service_key, active'),
      ]);
      if (!alive) return;

      const list = Array.isArray(rows) ? rows : [];
      if (list.length > 0) {
        setRole((membership as { role?: string } | null)?.role ?? null);
        setServices(
          list.filter((s: { active?: boolean }) => s.active !== false)
            .map((s: { service_key?: string }) => String(s.service_key ?? '')),
        );
        return;
      }
      // Vide = très probablement pré-auth (RLS sans auth.uid()) → on retente.
      tries += 1;
      if (tries < 8) timer = setTimeout(attempt, 800);
      else setServices([]); // on renonce : l'app reste utilisable, moteurs de base
    };

    void attempt();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);

  const value = useMemo<TenantValue>(() => {
    const list = services ?? [];
    const hasAny = (keys: string[]) => keys.some((k) => list.includes(k));
    return {
      ready: services !== null,
      role,
      isCreator: !!role && CREATOR_ROLES.includes(role),
      services: list,
      hasAny,
      schoolActive: hasAny(SCHOOL_KEYS),
      shopActive: hasAny(SHOP_KEYS),
      healthActive: hasAny(HEALTH_KEYS),
    };
  }, [role, services]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export const useTenant = () => useContext(TenantContext);
