import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * INFRASTRUCTURE ET CHARGE — ce que la plateforme coûte au fondateur.
 *
 * Le coût IA par tenant était déjà suivi (`founder_tenant_cost_overview`) ; tout
 * le reste — hébergement, base, média, e-mail, paiement — n'existait que dans
 * les factures des fournisseurs, chacune dans sa boîte mail. Ce service tient le
 * registre et la dépense.
 *
 * ⭐ DEUX GRANDEURS À NE JAMAIS CONFONDRE :
 *   — l'ENGAGEMENT : ce que je dois chaque mois, qu'il se passe quelque chose ou non ;
 *   — la DÉPENSE : ce que j'ai réellement payé, à une date, chez un fournisseur.
 * Un service facturé « à l'usage » a un engagement nul et une dépense bien réelle.
 * Les additionner dans un seul chiffre effacerait précisément l'écart entre le
 * prévu et le payé — qui est l'information utile.
 */
@Injectable()
export class InfraService {
  private readonly log = new Logger(InfraService.name);
  constructor(private readonly supabase: SupabaseService) {}

  /** Parité CFA FIXE (accord monétaire), pas un taux de marché. */
  private static XAF_PER_EUR = 655.957;
  private static ZERO_DECIMAL = new Set(['XAF', 'XOF', 'XPF', 'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV']);

  /**
   * Ramène un montant en EUROS (unité majeure). Renvoie `null` quand la devise
   * n'a pas de parité fixe — le dollar bouge tous les jours, et deviner un taux
   * pour faire joli dans un total serait un chiffre faux présenté comme un fait.
   */
  private static toEur(amountMinor: number, currency?: string): number | null {
    const c = String(currency || 'EUR').toUpperCase();
    const majeure = InfraService.ZERO_DECIMAL.has(c) ? amountMinor : amountMinor / 100;
    if (c === 'EUR') return majeure;
    if (c === 'XAF' || c === 'XOF') return majeure / InfraService.XAF_PER_EUR;
    return null;
  }

  /** Ramène un engagement à son équivalent MENSUEL. Un annuel divisé par douze. */
  private static mensuel(amountMinor: number, cycle?: string): number {
    const cy = String(cycle || 'mensuel').toLowerCase();
    if (cy === 'annuel') return amountMinor / 12;
    if (cy === 'mensuel') return amountMinor;
    return 0; // usage, gratuit : aucun engagement fixe
  }

  private get sb() { return this.supabase.client as any; }

  /** Vue complète : registre, santé, engagement, dépense du mois et sur 12 mois. */
  async overview() {
    const { data: services } = await this.sb
      .from('cimolace_infra_services')
      .select('*')
      .order('sort', { ascending: true });
    const liste: any[] = services ?? [];

    const debut12 = new Date();
    debut12.setUTCMonth(debut12.getUTCMonth() - 11, 1);
    const { data: expenses } = await this.sb
      .from('cimolace_infra_expenses')
      .select('*')
      .gte('period', debut12.toISOString().slice(0, 10))
      .order('period', { ascending: false });
    const depenses: any[] = expenses ?? [];

    const moisCourant = new Date().toISOString().slice(0, 7); // AAAA-MM

    // ── ENGAGEMENT mensuel, par devise puis converti ────────────────────────
    let engagementEur = 0;
    const engagementParDevise = new Map<string, number>();
    const nonConvertibles = new Map<string, number>();
    for (const s of liste) {
      if (String(s.statut) !== 'actif' && String(s.statut) !== 'essai') continue;
      const m = InfraService.mensuel(Number(s.amount_cents || 0), s.cycle);
      if (!m) continue;
      const cur = String(s.currency || 'EUR').toUpperCase();
      engagementParDevise.set(cur, (engagementParDevise.get(cur) || 0) + m);
      const eur = InfraService.toEur(m, cur);
      if (eur === null) nonConvertibles.set(cur, (nonConvertibles.get(cur) || 0) + m);
      else engagementEur += eur;
    }

    // ── DÉPENSE réelle ──────────────────────────────────────────────────────
    const parMois = new Map<string, number>();
    const parService = new Map<string, number>();
    let depenseMoisEur = 0;
    let depense12Eur = 0;
    const depNonConvertibles = new Map<string, number>();
    for (const d of depenses) {
      const eur = InfraService.toEur(Number(d.amount_cents || 0), d.currency);
      const mois = String(d.period).slice(0, 7);
      if (eur === null) {
        depNonConvertibles.set(String(d.currency).toUpperCase(), (depNonConvertibles.get(String(d.currency).toUpperCase()) || 0) + Number(d.amount_cents || 0));
        continue;
      }
      parMois.set(mois, (parMois.get(mois) || 0) + eur);
      parService.set(d.service_key, (parService.get(d.service_key) || 0) + eur);
      depense12Eur += eur;
      if (mois === moisCourant) depenseMoisEur += eur;
    }

    // ── SANTÉ : dernière sonde connue par service ───────────────────────────
    const { data: sante } = await this.sb
      .from('cimolace_provider_health_checks')
      .select('provider_key, status, latency_ms, checked_at, error_message')
      .order('checked_at', { ascending: false })
      .limit(400);
    const derniere = new Map<string, any>();
    for (const h of (sante ?? [])) {
      if (!derniere.has(h.provider_key)) derniere.set(h.provider_key, h);
    }

    const categories = new Map<string, { categorie: string; engagementEur: number; depense12Eur: number; services: number }>();
    for (const s of liste) {
      const cat = String(s.category || 'outil');
      const e = categories.get(cat) ?? { categorie: cat, engagementEur: 0, depense12Eur: 0, services: 0 };
      e.services += 1;
      if (['actif', 'essai'].includes(String(s.statut))) {
        const eur = InfraService.toEur(InfraService.mensuel(Number(s.amount_cents || 0), s.cycle), s.currency);
        if (eur) e.engagementEur += eur;
      }
      e.depense12Eur += parService.get(s.key) || 0;
      categories.set(cat, e);
    }

    return {
      services: liste.map((s) => ({
        ...s,
        mensuelEur: InfraService.toEur(InfraService.mensuel(Number(s.amount_cents || 0), s.cycle), s.currency),
        depense12Eur: parService.get(s.key) || 0,
        sante: derniere.get(s.key) ?? null,
      })),
      totaux: {
        engagementEur,
        engagementParDevise: [...engagementParDevise.entries()].map(([currency, montant]) => ({ currency, montant })),
        engagementNonConvertible: [...nonConvertibles.entries()].map(([currency, montant]) => ({ currency, montant })),
        depenseMoisEur,
        depense12Eur,
        depenseNonConvertible: [...depNonConvertibles.entries()].map(([currency, montant]) => ({ currency, montant })),
        servicesActifs: liste.filter((s) => s.statut === 'actif').length,
        servicesCritiques: liste.filter((s) => s.is_critical && s.statut === 'actif').length,
        moisCourant,
      },
      parMois: [...parMois.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mois, eur]) => ({ mois, eur })),
      categories: [...categories.values()].sort((a, b) => b.engagementEur - a.engagementEur),
      depenses,
    };
  }

  async upsertService(dto: any) {
    const key = String(dto?.key || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!key) throw new BadRequestException('key requis');
    if (!String(dto?.label || '').trim()) throw new BadRequestException('label requis');
    const ligne = {
      key,
      label: String(dto.label).trim(),
      category: String(dto.category || 'outil'),
      plan: dto.plan ?? null,
      amount_cents: Math.round(Number(dto.amount_cents) || 0),
      currency: String(dto.currency || 'EUR').toUpperCase(),
      cycle: String(dto.cycle || 'mensuel'),
      statut: String(dto.statut || 'actif'),
      renews_on: dto.renews_on || null,
      health_url: dto.health_url || null,
      console_url: dto.console_url || null,
      account_email: dto.account_email || null,
      is_critical: dto.is_critical === true,
      notes: dto.notes ?? null,
      sort: Number.isFinite(Number(dto.sort)) ? Number(dto.sort) : 100,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.sb
      .from('cimolace_infra_services')
      .upsert(ligne, { onConflict: 'key' })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async removeService(key: string) {
    const { error } = await this.sb.from('cimolace_infra_services').delete().eq('key', key);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  /** Une dépense appartient à un MOIS, pas à sa date de prélèvement. */
  async recordExpense(dto: any, createdBy: string | null) {
    const service_key = String(dto?.service_key || '').trim();
    if (!service_key) throw new BadRequestException('service_key requis');
    const mois = String(dto?.period || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mois)) throw new BadRequestException('period attendue au format AAAA-MM');
    const amount = Math.round(Number(dto?.amount_cents) || 0);
    if (!amount) throw new BadRequestException('amount_cents requis');
    const { data, error } = await this.sb
      .from('cimolace_infra_expenses')
      .upsert({
        service_key,
        period: `${mois}-01`,
        amount_cents: amount,
        currency: String(dto.currency || 'EUR').toUpperCase(),
        source: String(dto.source || 'manuel'),
        invoice_url: dto.invoice_url || null,
        note: dto.note ?? null,
        created_by: createdBy,
      }, { onConflict: 'service_key,period' })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async removeExpense(id: string) {
    const { error } = await this.sb.from('cimolace_infra_expenses').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  /**
   * Sonde les services qui déclarent une URL. C'est la réponse à « est-ce que ça
   * fonctionne ? » — la seule qui puisse être obtenue sans le tableau de bord de
   * chaque fournisseur. Un service sans URL n'est pas « en panne » : il est
   * NON SONDÉ, et l'écran doit dire lequel des deux.
   */
  async runHealthChecks() {
    const { data: services } = await this.sb
      .from('cimolace_infra_services')
      .select('key, label, health_url, statut')
      .not('health_url', 'is', null);
    const cibles = (services ?? []).filter((s: any) => s.statut === 'actif');
    const resultats: any[] = [];

    for (const s of cibles) {
      const t0 = Date.now();
      let status = 'ok';
      let error_message: string | null = null;
      try {
        const ctrl = new AbortController();
        const minuteur = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch(s.health_url, { signal: ctrl.signal, redirect: 'follow' });
        clearTimeout(minuteur);
        if (!r.ok) { status = 'warn'; error_message = `HTTP ${r.status}`; }
      } catch (e) {
        status = 'down';
        error_message = (e as Error)?.name === 'AbortError' ? 'Aucune réponse en 10 s' : (e as Error)?.message || 'injoignable';
      }
      const latency_ms = Date.now() - t0;
      resultats.push({ provider_key: s.key, label: s.label, status, latency_ms, error_message });
      await this.sb.from('cimolace_provider_health_checks').insert({
        provider_key: s.key, status, latency_ms, error_message,
        checked_at: new Date().toISOString(),
      });
    }
    this.log.log(`[infra] ${resultats.length} sonde(s) — ${resultats.filter((r) => r.status !== 'ok').length} anomalie(s)`);
    return { checked: resultats.length, resultats };
  }
}
