/**
 * Supabase Compatibility Adapter
 * 
 * Remplace supabase.from('table').select() par les appels API V2.
 * Garde le client Supabase réel pour l'auth et les tables sans endpoint API.
 * 
 * Usage: remplacer `import { supabase } from '@/lib/supabase'` par
 *        `import { supabase } from '@/lib/supabaseCompat'`
 */

import { createClient } from '@supabase/supabase-js';
import {
  livesApi,
  forumApi,
  notificationsApi,
  bookingApi,
  marketingApi,
  coursesApi,
  courseBuilderApi,
  messagingApi,
  chatEngineApi,
  medosApi,
  secretariatApi,
  growthApi,
  iriApi,
  masterclassApi,
  mboloApi,
  neuroRecallApi,
  payEngineApi,
  replayApi,
  videoEngineApi,
  emailEngineApi,
  smsEngineApi,
  aiWorkerApi,
  cimolaceBackofficeApi,
  tenantsApi,
  checkoutApi,
  catalogApi,
  liriApi,
} from './api-v2';
import { authStore } from './auth-store';

// ── Real Supabase client (for auth only) ────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseKey && supabaseUrl.startsWith('http') && supabaseKey.length > 20,
);

type SupabaseRuntimeGlobal = typeof globalThis & {
  __isnaV2SupabaseClient?: ReturnType<typeof createClient>;
  __isnaV2SupabaseConfigKey?: string;
};

const runtimeGlobal = globalThis as SupabaseRuntimeGlobal;
const runtimeConfigKey = `${supabaseUrl}|${supabaseKey.slice(0, 16)}`;

const realSupabase =
  runtimeGlobal.__isnaV2SupabaseClient && runtimeGlobal.__isnaV2SupabaseConfigKey === runtimeConfigKey
    ? runtimeGlobal.__isnaV2SupabaseClient
    : createClient(
        isSupabaseConfigured ? supabaseUrl : 'https://config-manquante.invalid',
        isSupabaseConfigured ? supabaseKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        {
          auth: {
            flowType: 'pkce',
            detectSessionInUrl: true,
            persistSession: true,
          },
        },
      );

runtimeGlobal.__isnaV2SupabaseClient = realSupabase;
runtimeGlobal.__isnaV2SupabaseConfigKey = runtimeConfigKey;

// ── Table → API mapping ─────────────────────────────────────────────────────

type SupabaseResult<T = any> = { data: T | null; error: Error | null };

function ok<T>(data: T): SupabaseResult<T> {
  return { data, error: null };
}

function err(message: string): SupabaseResult<null> {
  return { data: null, error: new Error(message) };
}

async function apiCall<T>(promise: Promise<T>): Promise<SupabaseResult<T>> {
  try {
    const data = await promise;
    return ok(data);
  } catch (e: any) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

// ── Query builder (émule la chaîne Supabase) ────────────────────────────────

class QueryBuilder<T = any> {
  private tableName: string;
  private filters: { field: string; value: any }[] = [];
  private inFilters: { field: string; values: any[] }[] = [];
  private orFilters: string[] = [];
  private singleFlag = false;
  private insertData: any = null;
  private updateData: any = null;
  private selectColumns = '*';
  private orderField: string | null = null;
  private orderAsc = true;
  private limitVal: number | null = null;
  private offsetVal: number | null = null;
  private rangeStart: number | null = null;
  private rangeEnd: number | null = null;
  private isDelete = false;
  private idFilter: string | null = null;
  private isFilters: { field: string; value: null | boolean }[] = [];
  private gteFilters: { field: string; value: any }[] = [];
  private lteFilters: { field: string; value: any }[] = [];
  private neqFilters: { field: string; value: any }[] = [];
  private upsertData: any = null;
  private upsertOptions: any = null;
  private selectOptions: any = null;

  constructor(table: string) {
    this.tableName = table;
  }

  select(columns = '*', options?: any) {
    this.selectColumns = columns;
    this.selectOptions = options ?? null;
    return this;
  }

  insert(data: any) {
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.updateData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, value });
    return this;
  }

  in(field: string, values: any[]) {
    this.inFilters.push({ field, values });
    return this;
  }

  or(expression: string) {
    this.orFilters.push(expression);
    return this;
  }

  is(field: string, value: null | boolean) {
    this.isFilters.push({ field, value });
    return this;
  }

  gte(field: string, value: any) {
    this.gteFilters.push({ field, value });
    return this;
  }

  lte(field: string, value: any) {
    this.lteFilters.push({ field, value });
    return this;
  }

  neq(field: string, value: any) {
    this.neqFilters.push({ field, value });
    return this;
  }

  not(field: string, _operator: string, _value: any) {
    // Simplified: treat as a no-op for compat; real filtering handled server-side
    return this;
  }

  upsert(data: any, options?: any) {
    this.upsertData = data;
    this.upsertOptions = options ?? null;
    return this;
  }

  single() {
    this.singleFlag = true;
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitVal = n;
    return this;
  }

  range(from: number, to: number) {
    this.rangeStart = from;
    this.rangeEnd = to;
    return this;
  }

  maybeSingle() {
    this.singleFlag = true;
    return this;
  }

  // ── Execute ───────────────────────────────────────────────────────────────

  async then<TResult1 = SupabaseResult<T>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResult<T>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    const result = this.normalizeResult(await this.execute());
    if (onfulfilled) return onfulfilled(result);
    return result as any;
  }

  /**
   * Garantit la forme du `data` retourné, façon supabase-js :
   * - requête « liste » (ni maybeSingle/single, ni insert/update/delete avec id) → toujours un tableau.
   *   L'API NestJS renvoie parfois une enveloppe { data: [...] } ; on l'aplatit pour éviter
   *   les crashes en aval (.map/.filter/.some is not a function) chez les consommateurs.
   * Les requêtes single conservent leur objet/null inchangé.
   */
  private normalizeResult(result: SupabaseResult<T>): SupabaseResult<T> {
    if (!result || result.error) return result;
    const isListQuery =
      !this.singleFlag && !this.insertData && !this.updateData && !this.upsertData && !this.isDelete;
    if (!isListQuery) return result;
    const d: any = result.data;
    if (Array.isArray(d)) return result;
    if (d && Array.isArray(d.data)) return { ...result, data: d.data as any };
    if (d == null) return { ...result, data: [] as any };
    // Objet inattendu pour une requête liste → on enveloppe défensivement.
    return { ...result, data: [d] as any };
  }

  private async execute(): Promise<SupabaseResult<T>> {
    // Extract id from filters
    const idFilter = this.filters.find(f => f.field === 'id');
    const id = idFilter?.value as string | undefined;
    
    // Extract tenant_id from filters (should match current tenant)
    // Tenant isolation is handled by X-Tenant-Slug header in the API

    // ── Route to API based on table ─────────────────────────────────────────

    switch (this.tableName) {
      // LIVE
      case 'live_sessions': {
        if (this.insertData) return apiCall(livesApi.create(this.insertData));
        if (this.updateData && id) {
          // Update via API if available
          return ok(this.updateData);
        }
        if (id) return apiCall(livesApi.get(id));
        return apiCall(livesApi.list(this.limitVal ?? 20, this.rangeStart ?? 0));
      }

      // FORUM
      case 'forum_topics': {
        if (this.insertData) return apiCall(forumApi.createTopic(this.insertData));
        if (id) return apiCall(forumApi.getTopic(id));
        const params: Record<string, string> = {};
        const catFilter = this.filters.find(f => f.field === 'category');
        if (catFilter) params.category = String(catFilter.value);
        return apiCall(forumApi.listTopics(params));
      }
      case 'forum_posts': {
        if (this.insertData) {
          const topicFilter = this.filters.find(f => f.field === 'topic_id');
          if (topicFilter) return apiCall(forumApi.createPost(String(topicFilter.value), this.insertData));
        }
        const topicFilter = this.filters.find(f => f.field === 'topic_id');
        if (topicFilter) return apiCall(forumApi.listPosts(String(topicFilter.value)));
        return ok([]);
      }
      case 'forum_categories':
        return apiCall(forumApi.listCategories());

      // NOTIFICATIONS
      case 'notifications': {
        if (this.insertData) return apiCall(notificationsApi.send(this.insertData));
        if (this.updateData && id) return apiCall(notificationsApi.markRead(id));
        return apiCall(notificationsApi.list());
      }

      // BOOKING
      case 'booking_slots': {
        if (this.insertData) return apiCall(bookingApi.createSlot(this.insertData));
        if (id) return apiCall(bookingApi.getSlot(id));
        return apiCall(bookingApi.listSlots());
      }
      case 'appointments': {
        if (this.insertData) return apiCall(bookingApi.createAppointment(this.insertData));
        if (id) return apiCall(bookingApi.getAppointment(id));
        return apiCall(bookingApi.listAppointments());
      }
      case 'appointment_feedback':
        return apiCall(bookingApi.getFeedback(id || ''));

      // MARKETING
      case 'promo_codes':
      case 'marketing_promo_codes': {
        if (this.insertData) return apiCall(marketingApi.createPromo(this.insertData));
        if (this.updateData && id) return apiCall(marketingApi.updatePromo(id, this.updateData));
        return apiCall(marketingApi.listPromos());
      }
      case 'popups':
      case 'marketing_popups': {
        if (this.insertData) return apiCall(marketingApi.createPopup(this.insertData));
        if (this.updateData && id) return apiCall(marketingApi.updatePopup(id, this.updateData));
        return apiCall(marketingApi.listPopups());
      }
      case 'banners':
      case 'marketing_banners': {
        if (this.insertData) return apiCall(marketingApi.createBanner(this.insertData));
        if (this.updateData && id) return apiCall(marketingApi.updateBanner(id, this.updateData));
        return apiCall(marketingApi.listBanners());
      }

      // COURSES
      case 'courses': {
        if (this.insertData) return apiCall(coursesApi.create(this.insertData));
        if (id) return apiCall(coursesApi.get(id));
        return apiCall(coursesApi.list());
      }
      case 'course_modules':
      case 'modules': {
        const courseFilter = this.filters.find(f => f.field === 'course_id');
        if (courseFilter) return apiCall(coursesApi.listModules(String(courseFilter.value)));
        return ok([]);
      }
      case 'course_lessons':
      case 'lessons': {
        const moduleFilter = this.filters.find(f => f.field === 'module_id');
        if (moduleFilter) return apiCall(coursesApi.listLessons(String(moduleFilter.value)));
        return ok([]);
      }

      // TENANT
      case 'tenants': {
        if (id) return apiCall(tenantsApi.current());
        return apiCall(tenantsApi.current());
      }
      case 'tenant_memberships': {
        const userIdFilter = this.filters.find(f => f.field === 'user_id');
        if (this.updateData && userIdFilter) {
          return apiCall(tenantsApi.updateMemberRole(String(userIdFilter.value), this.updateData.role));
        }
        return apiCall(tenantsApi.listMembers());
      }

      // COURSE BUILDER
      case 'course_pipelines': {
        if (this.insertData) return apiCall(courseBuilderApi.createPipeline(this.insertData));
        if (id) {
          // Could be segment or render
          return apiCall(courseBuilderApi.listSegments(id));
        }
        return apiCall(courseBuilderApi.listPipelines());
      }

      // MESSAGING
      case 'conversations':
      case 'messages': {
        if (this.insertData) return apiCall(messagingApi.send(this.insertData));
        if (id) return apiCall(messagingApi.getConversation(id));
        return apiCall(messagingApi.listConversations());
      }

      // CHAT ENGINE
      case 'chat_rooms': {
        if (this.insertData) return apiCall(chatEngineApi.createRoom(this.insertData));
        if (id) return apiCall(chatEngineApi.getMessages(id));
        return apiCall(chatEngineApi.listRooms());
      }

      // MEDOS
      case 'med_patients':
      case 'patients': {
        if (this.insertData) return apiCall(medosApi.createPatient(this.insertData));
        if (this.updateData && id) return apiCall(medosApi.updatePatient(id, this.updateData));
        if (id) return apiCall(medosApi.getPatient(id));
        return apiCall(medosApi.listPatients());
      }
      case 'med_notes':
      case 'consultation_notes': {
        const patientFilter = this.filters.find(f => f.field === 'patient_id');
        if (this.insertData && patientFilter) return apiCall(medosApi.createNote(String(patientFilter.value), this.insertData));
        if (this.updateData && id) return apiCall(medosApi.updateNote(id, this.updateData));
        if (patientFilter) return apiCall(medosApi.listNotes(String(patientFilter.value)));
        return apiCall(medosApi.mySharedNotes());
      }
      case 'med_forms':
      case 'medical_forms': {
        if (this.insertData) return apiCall(medosApi.createForm(this.insertData));
        if (id) return apiCall(medosApi.getForm(id));
        return apiCall(medosApi.listForms());
      }
      case 'med_health_entries':
      case 'health_entries': {
        if (this.insertData) return apiCall(medosApi.createHealthEntry(this.insertData));
        const patientFilter = this.filters.find(f => f.field === 'patient_id');
        if (patientFilter) return apiCall(medosApi.getHealthEntries(String(patientFilter.value)));
        return ok([]);
      }

      // SECRETARIAT
      case 'enrollments': {
        if (this.updateData && id) return apiCall(secretariatApi.updateEnrollment(id, this.updateData));
        return apiCall(secretariatApi.listEnrollments());
      }
      case 'secretariat_documents':
        return apiCall(secretariatApi.listDocuments());
      case 'secretariat_workflow':
        return apiCall(secretariatApi.getWorkflow());

      // GROWTH
      case 'leads': {
        if (this.insertData) return apiCall(growthApi.createLead(this.insertData));
        return apiCall(growthApi.listLeads());
      }

      // IRI
      case 'iri_pages': {
        if (this.insertData) return apiCall(iriApi.createPage(this.insertData));
        const slugFilter = this.filters.find(f => f.field === 'slug');
        if (slugFilter) return apiCall(iriApi.getPage(String(slugFilter.value)));
        return apiCall(iriApi.listPages());
      }

      // MASTERCLASS
      case 'masterclasses': {
        if (this.insertData) return apiCall(masterclassApi.generate(this.insertData));
        if (id) return apiCall(masterclassApi.get(id));
        return apiCall(masterclassApi.list());
      }

      // MBOLO
      case 'mbolo_products':
      case 'products': {
        if (this.insertData) return apiCall(mboloApi.createProduct(this.insertData));
        if (id) return apiCall(mboloApi.getProduct(id));
        return apiCall(mboloApi.listProducts());
      }
      case 'cart_items': {
        if (this.insertData) return apiCall(mboloApi.addToCart(this.insertData.productId, this.insertData.quantity));
        return apiCall(mboloApi.getCart());
      }
      case 'orders': {
        if (id) return apiCall(mboloApi.getOrder(id));
        return apiCall(mboloApi.listOrders());
      }

      // NEURO RECALL
      case 'neuro_decks':
      case 'recall_decks': {
        if (this.insertData) return apiCall(neuroRecallApi.createDeck(this.insertData));
        if (id) return apiCall(neuroRecallApi.getDueCards(id));
        return apiCall(neuroRecallApi.listDecks());
      }

      // REPLAY
      case 'live_recordings': {
        if (id) return apiCall(replayApi.getPlayback(id));
        return apiCall(replayApi.listRecordings());
      }
      case 'replays':
        return apiCall(replayApi.listReplays());

      // VIDEO ENGINE
      case 'video_assets': {
        if (this.insertData) return apiCall(videoEngineApi.createAsset(this.insertData));
        if (id) return apiCall(videoEngineApi.getAsset(id));
        return apiCall(videoEngineApi.listAssets());
      }

      // EMAIL ENGINE
      case 'email_templates': {
        if (this.insertData) return apiCall(emailEngineApi.createTemplate(this.insertData));
        return apiCall(emailEngineApi.listTemplates());
      }
      case 'email_campaigns':
        return apiCall(emailEngineApi.listCampaigns());

      // SMS ENGINE
      case 'sms_logs':
        return apiCall(smsEngineApi.getLogs());

      // AI WORKER
      case 'ai_jobs': {
        if (this.insertData) return apiCall(aiWorkerApi.enqueue(this.insertData));
        if (id) return apiCall(aiWorkerApi.getJob(id));
        return apiCall(aiWorkerApi.listJobs());
      }

      // CIMOLACE BACKOFFICE
      case 'cimolace_clients': {
        if (this.insertData) return apiCall(cimolaceBackofficeApi.createClient(this.insertData));
        if (this.updateData && id) return apiCall(cimolaceBackofficeApi.updateClient(id, this.updateData));

        const result = await apiCall(cimolaceBackofficeApi.listClients());
        if (result.error) return result as SupabaseResult<T>;
        return ok(this.applyLocalQuery(result.data ?? []) as T);
      }
      case 'cimolace_sites': {
        if (this.insertData) return apiCall(cimolaceBackofficeApi.createSite(this.insertData));
        if (this.updateData && id) return apiCall(cimolaceBackofficeApi.updateSite(id, this.updateData));
        if (this.isDelete && id) return apiCall(cimolaceBackofficeApi.deleteSite(id));

        const clientFilter = this.filters.find(f => f.field === 'client_id');
        const result = await apiCall(
          clientFilter
            ? cimolaceBackofficeApi.getClientSites(String(clientFilter.value))
            : cimolaceBackofficeApi.listSites(),
        );
        if (result.error) return result as SupabaseResult<T>;
        return ok(this.applyLocalQuery(result.data ?? []) as T);
      }

      // CATALOG
      case 'cimolace_engines':
        return apiCall(catalogApi.getEngines());
      case 'tenant_services':
        return apiCall(catalogApi.getTenantServices());

      // CHECKOUT
      case 'access_passes': {
        return ok([]);
      }

      // LIRI
      case 'liri_conversations': {
        if (id) return apiCall(liriApi.getConversation(id));
        return apiCall(liriApi.listConversations());
      }
      case 'liri_models':
        return apiCall(liriApi.getModels());

      // ── Tables that don't exist yet — return empty to stop 404 floods ───
      case 'live_visibility_rules':
      case 'live_notifications':
      case 'live_chat_invites':
      case 'live_waiting_room_entries':
      case 'live_invitations':
      case 'appointment_requests':
      case 'billing_payments':
      case 'billing_subscriptions':
      case 'formations':
      case 'formation_day_contents':
      case 'app_settings':
        return ok(this.singleFlag ? (null as any) : ([] as any));

      // ── Student tracking — route to real Supabase (RLS-protected) ────────
      case 'attendance_records':
      case 'student_progress':
        return this.executeRealSupabase();

      // ── Fallback: use real Supabase for unmapped tables ──────────────────
      default: {
        return this.executeRealSupabase();
      }
    }
  }

  private async executeRealSupabase(): Promise<SupabaseResult<T>> {
    // Fallback to real Supabase for tables without API endpoints
    let query: any;

    if (this.upsertData) {
      query = realSupabase.from(this.tableName).upsert(this.upsertData, this.upsertOptions ?? {}).select(this.selectColumns);
    } else if (this.insertData) {
      query = realSupabase.from(this.tableName).insert(this.insertData).select(this.selectColumns);
    } else if (this.updateData) {
      query = realSupabase.from(this.tableName).update(this.updateData);
    } else if (this.isDelete) {
      query = realSupabase.from(this.tableName).delete();
    } else {
      query = this.selectOptions
        ? realSupabase.from(this.tableName).select(this.selectColumns, this.selectOptions)
        : realSupabase.from(this.tableName).select(this.selectColumns);
    }

    // Apply filters
    for (const f of this.filters) {
      query = query.eq(f.field, f.value);
    }
    for (const f of this.inFilters) {
      query = query.in(f.field, f.values);
    }
    for (const expression of this.orFilters) {
      query = query.or(expression);
    }
    for (const f of this.isFilters) {
      query = query.is(f.field, f.value);
    }
    for (const f of this.gteFilters) {
      query = query.gte(f.field, f.value);
    }
    for (const f of this.lteFilters) {
      query = query.lte(f.field, f.value);
    }
    for (const f of this.neqFilters) {
      query = query.neq(f.field, f.value);
    }

    if (this.orderField) {
      query = query.order(this.orderField, { ascending: this.orderAsc });
    }
    if (this.limitVal) {
      query = query.limit(this.limitVal);
    }
    if (this.rangeStart !== null && this.rangeEnd !== null) {
      query = query.range(this.rangeStart, this.rangeEnd);
    }
    if (this.singleFlag) {
      query = query.maybeSingle();
    }

    try {
      const result = await query;
      if (result.error) {
        return { data: null, error: new Error(result.error.message) };
      }
      return { data: result.data as T, error: null };
    } catch (e: any) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  private applyLocalQuery(rows: any[]): any {
    let data = Array.isArray(rows) ? [...rows] : [];

    for (const filter of this.filters) {
      data = data.filter((row) => row?.[filter.field] === filter.value);
    }

    for (const filter of this.inFilters) {
      const allowed = new Set(filter.values);
      data = data.filter((row) => allowed.has(row?.[filter.field]));
    }

    for (const expression of this.orFilters) {
      data = data.filter((row) => this.matchesOrExpression(row, expression));
    }
    for (const filter of this.isFilters) {
      data = data.filter((row) =>
        filter.value === null
          ? row?.[filter.field] === null || row?.[filter.field] === undefined
          : row?.[filter.field] === filter.value,
      );
    }
    for (const filter of this.gteFilters) {
      data = data.filter((row) => row?.[filter.field] >= filter.value);
    }
    for (const filter of this.lteFilters) {
      data = data.filter((row) => row?.[filter.field] <= filter.value);
    }
    for (const filter of this.neqFilters) {
      data = data.filter((row) => row?.[filter.field] !== filter.value);
    }

    if (this.orderField) {
      const field = this.orderField;
      const direction = this.orderAsc ? 1 : -1;
      data.sort((a, b) => String(a?.[field] ?? '').localeCompare(String(b?.[field] ?? '')) * direction);
    }

    if (this.rangeStart !== null && this.rangeEnd !== null) {
      data = data.slice(this.rangeStart, this.rangeEnd + 1);
    } else if (this.limitVal !== null) {
      data = data.slice(0, this.limitVal);
    }

    if (this.singleFlag) {
      return data[0] ?? null;
    }

    return data;
  }

  private matchesOrExpression(row: any, expression: string): boolean {
    return expression.split(',').some((rawClause) => {
      const clause = rawClause.trim();
      const [field, operator, ...rest] = clause.split('.');
      const expected = rest.join('.');
      const actual = String(row?.[field] ?? '');

      if (operator === 'ilike') {
        const needle = expected.replace(/^%|%$/g, '').toLowerCase();
        return actual.toLowerCase().includes(needle);
      }

      if (operator === 'eq') {
        return actual === expected;
      }

      return false;
    });
  }

}

// ── Realtime stub ───────────────────────────────────────────────────────────

class ChannelStub {
  on(_event: string, _filter: any, _callback: Function) { return this; }
  subscribe(_callback?: Function) { return this; }
  unsubscribe() { return this; }
  send(_payload: any) { return this; }
}

// ── Storage stub ────────────────────────────────────────────────────────────

const storageStub = {
  from: (_bucket: string) => ({
    upload: async (_path: string, _file: any) => ok({ path: _path }),
    download: async (_path: string) => ok(null),
    getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
    remove: async (_paths: string[]) => ok(null),
    list: async (_prefix?: string) => ok([]),
  }),
};

// ── RPC stub ────────────────────────────────────────────────────────────────

const rpcStub = async (_fn: string, _params?: any) => {
  return { data: null, error: new Error('RPC non supporté via API — utiliser Supabase direct') };
};

// ── Exported adapter ────────────────────────────────────────────────────────

export const supabase = {
  // Auth — keep real Supabase
  auth: realSupabase.auth,

  // Data — routed through API
  from: (table: string) => new QueryBuilder(table),

  // Realtime — stub for now (V1 live uses LiveKit, not Supabase Realtime)
  channel: (_name: string) => new ChannelStub(),

  // Storage — stub
  storage: storageStub,

  // RPC
  rpc: rpcStub,

  // Utility
  removeChannel: (_channel: any) => {},
};
