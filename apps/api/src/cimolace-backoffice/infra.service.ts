import { BadRequestException, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
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
export class InfraService implements OnApplicationBootstrap {
  private readonly log = new Logger(InfraService.name);
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Sonde planifiée. Déclenchée à la main, elle ne servait qu'aux jours où l'on
   * y pensait — donc jamais la nuit où un fournisseur tombe. Une passe horaire,
   * dans le `onApplicationBootstrap` déjà utilisé ailleurs dans ce repo
   * (pas de `@nestjs/schedule` ici, ne pas en introduire un pour une boucle).
   */
  onApplicationBootstrap() {
    const HEURE = 60 * 60 * 1000;
    // Décalage au démarrage : ne pas sonder pendant que l'instance boote,
    // sinon un redéploiement se signale lui-même comme une panne.
    setTimeout(() => { void this.runHealthChecks().catch(() => {}); }, 90 * 1000);
    setInterval(() => { void this.runHealthChecks().catch(() => {}); }, HEURE).unref?.();
  }

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

  /**
   * USAGE RÉEL RAILWAY — la seule automatisation crédible du lot.
   *
   * Railway injecte déjà `RAILWAY_PROJECT_ID` dans le conteneur ; il ne manque
   * qu'un jeton d'API, qui n'est PAS fourni automatiquement (les variables
   * RAILWAY_* natives ne contiennent aucune clé). Sans lui, on renvoie
   * `configure: false` avec la marche à suivre — jamais un chiffre inventé pour
   * remplir la case.
   */
  async railwayUsage() {
    const token = process.env.RAILWAY_API_TOKEN;
    const projectId = process.env.RAILWAY_PROJECT_ID;
    if (!token) {
      return {
        configure: false,
        raison: "Aucun RAILWAY_API_TOKEN sur le service. Crée un jeton sur railway.com (Account → Tokens) et pose-le en variable pour lire l'usage réel.",
      };
    }
    if (!projectId) return { configure: false, raison: 'RAILWAY_PROJECT_ID absent du conteneur.' };

    // Fenêtre = mois courant, pour se comparer à la dépense saisie du même mois.
    const debut = new Date();
    debut.setUTCDate(1); debut.setUTCHours(0, 0, 0, 0);
    const requete = {
      query: `query($projectId: String!, $startDate: DateTime!) {
        estimatedUsage(projectId: $projectId, startDate: $startDate) {
          estimatedValue measurement
        }
      }`,
      variables: { projectId, startDate: debut.toISOString() },
    };
    try {
      const r = await fetch('https://backboard.railway.com/graphql/v2', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requete),
      });
      if (!r.ok) return { configure: true, erreur: `Railway a répondu ${r.status}.` };
      const j: any = await r.json();
      if (j?.errors?.length) return { configure: true, erreur: String(j.errors[0]?.message || 'requête refusée') };
      const lignes = (j?.data?.estimatedUsage ?? []).map((u: any) => ({
        mesure: u.measurement, valeur: Number(u.estimatedValue || 0),
      }));
      const cout = lignes.find((l: any) => String(l.mesure).toUpperCase().includes('CREDIT'));
      return { configure: true, depuis: debut.toISOString().slice(0, 10), lignes, estimationUsd: cout?.valeur ?? null };
    } catch (e) {
      return { configure: true, erreur: (e as Error)?.message || 'Railway injoignable.' };
    }
  }

  /**
   * Revenus encaissés, ramenés en euros — pour mettre la charge en face de ce
   * qu'elle produit. Lecture ciblée de billing_invoices : appeler
   * getPlatformFinances aurait traîné un aller-retour pawaPay de ~3 s dans un
   * écran qui n'en a pas besoin.
   */
  private async revenusEur() {
    const { data } = await this.sb.from('billing_invoices').select('amount_cents, status, currency');
    let eur = 0;
    for (const i of (data ?? [])) {
      if (String(i.status || '').toLowerCase() !== 'paid') continue;
      const v = InfraService.toEur(Number(i.amount_cents || 0), i.currency);
      if (v !== null) eur += v;
    }
    return eur;
  }

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

    // CHARGE FACE AUX REVENUS. Un engagement de 200 € ne veut rien dire seul :
    // il est confortable à 2 000 € encaissés, mortel à 150 €.
    const revenus = await this.revenusEur().catch(() => 0);
    const chargeMensuelle = engagementEur + depenseMoisEur;

    return {
      revenus: {
        encaisseEur: revenus,
        // Part des revenus mangée par l'infrastructure. `null` tant qu'aucun
        // revenu n'est encaissé : diviser par zéro donnerait « ∞ % », un chiffre
        // spectaculaire qui ne dit rien.
        partInfraPct: revenus > 0 ? Math.round((chargeMensuelle / revenus) * 100) : null,
        margeEur: revenus - chargeMensuelle,
      },
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
    const erreursEcriture: string[] = [];
    let enregistrees = 0;

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

      // ⛔ VÉRIFIER L'ÉCRITURE. Supabase RENVOIE ses erreurs, il ne les lève pas :
      // sans ce contrôle, `client_id NOT NULL` faisait échouer chaque insertion
      // pendant que la méthode annonçait « 2 services sondés ». Un compte-rendu
      // de succès au-dessus de zéro écriture est pire que pas de sonde du tout.
      const { error } = await this.sb.from('cimolace_provider_health_checks').insert({
        client_id: null, // sonde PLATEFORME — un tenant renseignerait cette colonne
        provider_key: s.key, status, latency_ms, error_message,
        checked_at: new Date().toISOString(),
      });
      if (error) {
        this.log.error(`[infra] sonde ${s.key} NON ENREGISTRÉE : ${error.message}`);
        erreursEcriture.push(`${s.label} : ${error.message}`);
      } else {
        enregistrees += 1;
      }
      resultats.push({ provider_key: s.key, label: s.label, status, latency_ms, error_message });
    }
    this.log.log(`[infra] ${resultats.length} sonde(s), ${enregistrees} enregistrée(s) — ${resultats.filter((r) => r.status !== 'ok').length} anomalie(s)`);
    // `checked` = ce qui a été sondé ; `enregistrees` = ce qui a réellement été
    // écrit. Deux nombres, parce qu'ils peuvent différer et que l'appelant doit
    // pouvoir le savoir.
    return { checked: resultats.length, enregistrees, erreursEcriture, resultats };
  }
}
