import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import AutomationFlowCanvas from '@/components/marketing/AutomationFlowCanvas';
import { useToast } from '@/components/ui/use-toast';
import {
  BarChart3,
  Megaphone,
  Workflow,
  GitBranch,
  RefreshCw,
  Loader2,
  CalendarDays,
  Link2,
  Facebook,
  Youtube,
  Globe,
  Film,
  Copy,
} from 'lucide-react';
import { resolveNetlifyApiUrl } from '@/lib/resolveNetlifyApiUrl';
import { fetchTenantContext } from '@/lib/tenant/fetchTenantContext';
import { getApiBaseUrl } from '@/lib/apiBase';
import { authStore } from '@/lib/auth-store';

// ── Migration Netlify(mort sur Vercel) → API NestJS `/marketing/*` (2026-07-18) ──
// Mappe chaque chemin legacy `/api/marketing/*` vers sa route NestJS réelle.
// `method` (optionnel) surcharge le verbe (ex : update automation = PATCH côté Nest).
const MARKETING_ROUTE_MAP = {
  '/api/marketing/analytics':          { path: '/marketing/analytics' },
  '/api/marketing/leads':              { path: '/marketing/leads' },
  '/api/marketing/funnels':            { path: '/marketing/funnels' },
  '/api/marketing/campaigns':          { path: '/marketing/campaigns' },
  '/api/marketing/logs':               { path: '/marketing/logs' },
  '/api/marketing/orchestrate':        { path: '/marketing/orchestrate' },
  '/api/marketing/publish':            { path: '/marketing/publish' },
  '/api/marketing/score/refresh':      { path: '/marketing/score-refresh' },
  '/api/marketing/payment/recovery':   { path: '/marketing/payment-recovery' },
  '/api/marketing/ai/suggest-message': { path: '/marketing/ai-suggest-message' },
  '/api/marketing/campaign/create':    { path: '/marketing/campaigns', method: 'POST' },
  '/api/marketing/campaign/start':     { path: '/marketing/campaigns/action', method: 'POST' },
  '/api/marketing/funnel/create':      { path: '/marketing/funnels', method: 'POST' },
  '/api/marketing/lead/capture':       { path: '/marketing/leads/capture', method: 'POST' },
  '/api/marketing/automation/list':    { path: '/marketing/automations' },
  '/api/marketing/automation/audit':   { path: '/marketing/automations/audit' },
  '/api/marketing/automation/create':  { path: '/marketing/automations', method: 'POST' },
  '/api/marketing/automation/update':  { path: '/marketing/automations', method: 'PATCH' },
  '/api/marketing/automation/delete':  { path: '/marketing/automations/delete', method: 'POST' },
  '/api/marketing/automation/run':     { path: '/marketing/automations/run', method: 'POST' },
};

const objectiveOptions = [
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'conversion', label: 'Conversion' },
  { value: 'relance', label: 'Relance' },
  { value: 'reactivation', label: 'Reactivation' },
];

export default function AdminMarketingPage() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('campaigns');
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [leads, setLeads] = useState([]);
  const [funnels, setFunnels] = useState([]);
  const [marketingLogs, setMarketingLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsActionPrefix, setLogsActionPrefix] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const logsPageSize = 100;
  const [flows, setFlows] = useState([]);
  const [automationAuditLogs, setAutomationAuditLogs] = useState([]);
  const [kbEntries, setKbEntries] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    objective: 'acquisition',
    audience: 'new_leads',
    channel: 'email',
    contentMessage: '',
  });
  const [funnelForm, setFunnelForm] = useState({
    name: '',
    linkedFormationId: '',
  });
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [funnelSaving, setFunnelSaving] = useState(false);
  const [flowSaving, setFlowSaving] = useState(false);
  const [scoreRefreshLoading, setScoreRefreshLoading] = useState(false);
  const [orchestrateLoading, setOrchestrateLoading] = useState(false);
  const [orchestrateResult, setOrchestrateResult] = useState(null);
  const [flowForm, setFlowForm] = useState({
    name: '',
    trigger: 'lead_created',
    conditionOperator: 'AND',
  });
  const [flowConditionRules, setFlowConditionRules] = useState([{ id: 'c-1', type: 'none' }]);
  const [flowActions, setFlowActions] = useState([{ id: 'a-1', branch: 'yes', actionType: 'send_email' }]);
  const [flowNodePositions, setFlowNodePositions] = useState({});
  const [editingFlowId, setEditingFlowId] = useState(null);
  const [automationStatusFilter, setAutomationStatusFilter] = useState('all');
  const [automationSearch, setAutomationSearch] = useState('');
  const [flowActionLoading, setFlowActionLoading] = useState({});
  const [selectedFlowIds, setSelectedFlowIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkReport, setBulkReport] = useState(null);
  const [automationAutoRefresh, setAutomationAutoRefresh] = useState(true);
  const [auditPeriod, setAuditPeriod] = useState('30d');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditActorSearch, setAuditActorSearch] = useState('');
  const [auditSortOrder, setAuditSortOrder] = useState('desc');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(8);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbSaving, setKbSaving] = useState(false);
  const [kbImporting, setKbImporting] = useState(false);
  const [kbSearch, setKbSearch] = useState('');
  const [kbOnlyActive, setKbOnlyActive] = useState(true);
  const [kbForm, setKbForm] = useState({
    id: '',
    title: '',
    content: '',
    source_type: 'manual',
    source_url: '',
    intents: '',
    keywords: '',
    priority: 50,
    is_active: true,
  });
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [automationTabLoading, setAutomationTabLoading] = useState(false);
  const automationInitRef = useRef(false);
  const skipNextTabNavigateRef = useRef(false);
  const [flowListPage, setFlowListPage] = useState(1);
  const flowListPageSize = 10;
  const validTabs = useMemo(
    () => ['campaigns', 'funnels', 'leads', 'logs', 'automation', 'response', 'orchestration', 'analytics', 'channels'],
    []
  );

  // Sync URL → onglet : UNIQUEMENT quand l'URL change (deep-link, bouton retour).
  // ⚠️ NE PAS mettre `tab` dans les deps : sinon un clic (setTab) redéclenche cet
  // effet, qui lit l'URL encore périmée et REVERT l'onglet → les onglets ne se
  // cliquaient plus. L'autre sens (onglet → URL) est géré par l'effet suivant.
  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const queryTab = String(params.get('tab') || '').toLowerCase();
    if (queryTab && validTabs.includes(queryTab) && queryTab !== tab) {
      skipNextTabNavigateRef.current = true;
      setTab(queryTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, validTabs]);

  useEffect(() => {
    if (skipNextTabNavigateRef.current) {
      skipNextTabNavigateRef.current = false;
      return;
    }
    const params = new URLSearchParams(location.search || '');
    if (params.get('tab') === tab) return;
    params.set('tab', tab);
    // Synchronise l'onglet sur la route COURANTE (ex. /liri/crm), pas sur un chemin
    // codé en dur : `/admin/marketing` redirige vers /liri/crm en perdant le ?tab=,
    // ce qui créait une boucle de redirection infinie (spinner permanent).
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }, [location.pathname, location.search, navigate, tab]);

  const authFetch = useCallback(async (url, options = {}) => {
    const { data: sessData } = await supabase.auth.getSession();
    const token = sessData?.session?.access_token;
    if (!token) throw new Error('Session invalide');

    // Route les chemins marketing vers l'API NestJS (le backend Netlify est mort).
    const [rawPath, rawQs = ''] = String(url).split('?');
    const mapping = MARKETING_ROUTE_MAP[rawPath];
    if (mapping) {
      const slug = authStore.getTenantSlug();
      // Le tenant passe par l'en-tête X-Tenant-Slug (TenantGuard), pas par ?tenant_slug=.
      const qs = new URLSearchParams(rawQs);
      qs.delete('tenant_slug');
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const res = await fetch(`${getApiBaseUrl()}${mapping.path}${suffix}`, {
        ...options,
        method: mapping.method || options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(slug ? { 'X-Tenant-Slug': slug } : {}),
          ...(options.headers || {}),
        },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error?.message || payload?.message || payload?.error || 'Erreur API');
      }
      // L'API NestJS enveloppe la réponse dans { data: ... } → on dépile.
      return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    }

    // Repli (chemin non mappé) : ancien comportement Netlify.
    const resolved = resolveNetlifyApiUrl(url);
    const res = await fetch(resolved, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.error || 'Erreur API');
    return payload;
  }, []);

  /** Cœur marketing (sans automation lourde) */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const tenantCtx = await fetchTenantContext().catch(() => null);
      const tenantSlug = tenantCtx?.slug ? String(tenantCtx.slug).trim().toLowerCase() : '';
      const tenantQs = tenantSlug ? `tenant_slug=${encodeURIComponent(tenantSlug)}` : '';
      const withTenant = (path) =>
        tenantQs ? `${path}${path.includes('?') ? '&' : '?'}${tenantQs}` : path;

      const [analyticsRes, leadsRes, funnelsRes, campaignsRes] = await Promise.all([
        authFetch(withTenant('/api/marketing/analytics')),
        authFetch(withTenant('/api/marketing/leads')),
        authFetch(withTenant('/api/marketing/funnels')),
        authFetch(withTenant('/api/marketing/campaigns')),
      ]);
      setCampaigns(Array.isArray(campaignsRes?.campaigns) ? campaignsRes.campaigns : []);
      setLeads(Array.isArray(leadsRes?.leads) ? leadsRes.leads : []);
      setAnalytics(analyticsRes || null);
      setFunnels(Array.isArray(funnelsRes?.funnels) ? funnelsRes.funnels : []);
    } catch (e) {
      toast({ title: 'Marketing Engine', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [authFetch, toast]);

  /** Flows + audit — chargé à la demande (onglet Automation) pour éviter de tout charger d'un coup */
  const loadAutomationData = useCallback(async () => {
    setAutomationTabLoading(true);
    try {
      const tenantCtx = await fetchTenantContext().catch(() => null);
      const tenantSlug = tenantCtx?.slug ? String(tenantCtx.slug).trim().toLowerCase() : '';
      const tenantQs = tenantSlug ? `tenant_slug=${encodeURIComponent(tenantSlug)}` : '';
      const withTenant = (path) =>
        tenantQs ? `${path}${path.includes('?') ? '&' : '?'}${tenantQs}` : path;

      const [flowsRes, auditRes] = await Promise.all([
        authFetch(withTenant('/api/marketing/automation/list')),
        authFetch(withTenant('/api/marketing/automation/audit')),
      ]);
      setFlows(Array.isArray(flowsRes?.flows) ? flowsRes.flows : []);
      setAutomationAuditLogs(Array.isArray(auditRes?.logs) ? auditRes.logs : []);
    } catch (e) {
      toast({ title: 'Automation', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setAutomationTabLoading(false);
    }
  }, [authFetch, toast]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const tenantCtx = await fetchTenantContext().catch(() => null);
      const tenantSlug = tenantCtx?.slug ? String(tenantCtx.slug).trim().toLowerCase() : '';
      const qs = new URLSearchParams();
      if (tenantSlug) qs.set('tenant_slug', tenantSlug);
      if (logsActionPrefix.trim()) qs.set('action_prefix', logsActionPrefix.trim());
      qs.set('limit', String(logsPageSize));
      qs.set('offset', String((logsPage - 1) * logsPageSize));
      const payload = await authFetch(`/api/marketing/logs?${qs.toString()}`);
      setMarketingLogs(Array.isArray(payload?.logs) ? payload.logs : []);
    } catch (e) {
      toast({ title: 'Logs marketing', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setLogsLoading(false);
    }
  }, [authFetch, logsActionPrefix, logsPage, toast]);

  const copyMarketingLogPayload = useCallback(
    async (log) => {
      const raw = log?.payload_json;
      const obj = raw && typeof raw === 'object' ? raw : {};
      const text = JSON.stringify(obj, null, 2);
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copié', description: 'payload_json', className: 'bg-emerald-700 text-white border-none' });
      } catch {
        toast({ title: 'Copie impossible', description: 'Autorise le presse-papiers ou copie manuelle.', variant: 'destructive' });
      }
    },
    [toast],
  );

  const markFlowLoading = useCallback((flowId, loadingState) => {
    setFlowActionLoading((prev) => {
      if (!flowId) return prev;
      if (loadingState) return { ...prev, [flowId]: true };
      const next = { ...prev };
      delete next[flowId];
      return next;
    });
  }, []);

  const loadKnowledgeBase = useCallback(async () => {
    setKbLoading(true);
    try {
      const qs = new URLSearchParams();
      if (kbSearch.trim()) qs.set('search', kbSearch.trim());
      if (kbOnlyActive) qs.set('active', 'true');
      const payload = await authFetch(`/api/response/kb/list?${qs.toString()}`);
      setKbEntries(Array.isArray(payload?.items) ? payload.items : []);
    } catch (e) {
      toast({ title: 'Knowledge Base', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setKbLoading(false);
    }
  }, [authFetch, kbOnlyActive, kbSearch, toast]);

  const loadFlowIntoEditor = useCallback((flow) => {
    if (!flow) return;
    setEditingFlowId(flow.id);
    setFlowForm({
      name: flow.name || '',
      trigger: flow.trigger || 'lead_created',
      conditionOperator: flow.conditions_json?.operator || 'AND',
    });
    const conditionRules = Array.isArray(flow.conditions_json?.rules) && flow.conditions_json.rules.length
      ? flow.conditions_json.rules
      : [{ type: flow.conditions_json?.type || 'none' }];
    setFlowConditionRules(
      conditionRules.map((rule, idx) => ({
        id: `c-load-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        type: rule.type || 'none',
      }))
    );
    const loadedActions = Array.isArray(flow.actions) ? flow.actions : [];
    setFlowActions(
      loadedActions.length
        ? loadedActions.map((action, idx) => ({
            id: action.id || `a-load-${idx}`,
            branch: action.config_json?.branch === 'no' ? 'no' : 'yes',
            actionType: action.action_type || 'send_email',
          }))
        : [{ id: 'a-1', branch: 'yes', actionType: 'send_email' }]
    );
    setFlowNodePositions(flow.conditions_json?.uiGraph?.nodePositions || {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (tab !== 'automation') return;
    if (automationInitRef.current) return;
    automationInitRef.current = true;
    void loadAutomationData();
  }, [tab, loadAutomationData]);

  useEffect(() => {
    if (tab !== 'automation' || !automationAutoRefresh) return undefined;
    const timer = setInterval(() => {
      void loadAutomationData();
    }, 45000);
    return () => clearInterval(timer);
  }, [automationAutoRefresh, loadAutomationData, tab]);

  useEffect(() => {
    if (tab !== 'logs') return;
    void loadLogs();
  }, [loadLogs, tab]);

  useEffect(() => {
    if (tab !== 'response') return;
    loadKnowledgeBase();
  }, [loadKnowledgeBase, tab]);

  const heatBreakdown = useMemo(() => {
    const hot = leads.filter((l) => Number(l.score || 0) >= 70).length;
    const warm = leads.filter((l) => Number(l.score || 0) >= 35 && Number(l.score || 0) < 70).length;
    const cold = Math.max(0, leads.length - hot - warm);
    return { hot, warm, cold };
  }, [leads]);

  const automationStats = useMemo(() => {
    const active = flows.filter((f) => String(f.status || '').toLowerCase() === 'active').length;
    const paused = flows.filter((f) => String(f.status || '').toLowerCase() === 'paused').length;
    const archived = flows.filter((f) => String(f.status || '').toLowerCase() === 'archived').length;
    return { active, paused, archived, total: flows.length };
  }, [flows]);

  const filteredFlows = useMemo(() => {
    const query = automationSearch.trim().toLowerCase();
    return (flows || [])
      .filter((flow) => {
        if (automationStatusFilter === 'all') return true;
        return String(flow.status || '').toLowerCase() === automationStatusFilter;
      })
      .filter((flow) => {
        if (!query) return true;
        return (
          String(flow.name || '').toLowerCase().includes(query) ||
          String(flow.trigger || '').toLowerCase().includes(query) ||
          String(flow.status || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
        const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
        return bDate - aDate;
      });
  }, [automationSearch, automationStatusFilter, flows]);

  const flowListTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredFlows.length / flowListPageSize)),
    [filteredFlows.length, flowListPageSize]
  );

  const paginatedFlows = useMemo(() => {
    const start = (Math.max(1, flowListPage) - 1) * flowListPageSize;
    return filteredFlows.slice(start, start + flowListPageSize);
  }, [filteredFlows, flowListPage, flowListPageSize]);

  useEffect(() => {
    setFlowListPage(1);
  }, [automationSearch, automationStatusFilter]);

  useEffect(() => {
    setSelectedFlowIds((prev) => prev.filter((id) => (flows || []).some((flow) => flow.id === id)));
  }, [flows]);

  const selectedFlowCount = selectedFlowIds.length;
  const filteredFlowIds = useMemo(() => filteredFlows.map((flow) => flow.id), [filteredFlows]);
  const allFilteredSelected = useMemo(
    () => filteredFlowIds.length > 0 && filteredFlowIds.every((id) => selectedFlowIds.includes(id)),
    [filteredFlowIds, selectedFlowIds]
  );

  const filteredAutomationAuditLogs = useMemo(() => {
    const now = Date.now();
    const periodDays =
      auditPeriod === '7d' ? 7 : auditPeriod === '30d' ? 30 : auditPeriod === '90d' ? 90 : auditPeriod === '180d' ? 180 : null;
    const actorQuery = auditActorSearch.trim().toLowerCase();

    return (automationAuditLogs || []).filter((log) => {
      const payload = log.payload_json && typeof log.payload_json === 'object' ? log.payload_json : {};
      const createdAt = new Date(log.created_at || 0).getTime();
      if (periodDays && Number.isFinite(createdAt)) {
        const msLimit = periodDays * 24 * 60 * 60 * 1000;
        if (now - createdAt > msLimit) return false;
      }

      const actionType = String(payload.actionType || '').toLowerCase();
      const actionLabel = String(log.action || '').toLowerCase();
      if (auditActionFilter !== 'all') {
        const expected = String(auditActionFilter).toLowerCase();
        if (actionType !== expected && !actionLabel.includes(expected)) return false;
      }

      if (actorQuery) {
        const actorEmail = String(payload.actorEmail || '').toLowerCase();
        const actorRole = String(payload.actorRole || '').toLowerCase();
        const actorName = String(payload.actorName || '').toLowerCase();
        const actorUserId = String(payload.actorUserId || '').toLowerCase();
        if (![actorEmail, actorRole, actorName, actorUserId].some((value) => value.includes(actorQuery))) return false;
      }

      return true;
    });
  }, [auditActionFilter, auditActorSearch, auditPeriod, automationAuditLogs]);

  const sortedAutomationAuditLogs = useMemo(() => {
    const copy = [...filteredAutomationAuditLogs];
    copy.sort((a, b) => {
      const aTs = new Date(a.created_at || 0).getTime();
      const bTs = new Date(b.created_at || 0).getTime();
      return auditSortOrder === 'asc' ? aTs - bTs : bTs - aTs;
    });
    return copy;
  }, [auditSortOrder, filteredAutomationAuditLogs]);

  const auditTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(sortedAutomationAuditLogs.length / Math.max(1, auditPageSize)));
  }, [auditPageSize, sortedAutomationAuditLogs.length]);

  const paginatedAutomationAuditLogs = useMemo(() => {
    const start = (Math.max(1, auditPage) - 1) * Math.max(1, auditPageSize);
    const end = start + Math.max(1, auditPageSize);
    return sortedAutomationAuditLogs.slice(start, end);
  }, [auditPage, auditPageSize, sortedAutomationAuditLogs]);

  const auditActionCounts = useMemo(() => {
    const counts = { run: 0, pause: 0, activate: 0, archive: 0, delete: 0 };
    for (const log of filteredAutomationAuditLogs) {
      const payload = log.payload_json && typeof log.payload_json === 'object' ? log.payload_json : {};
      const actionType = String(payload.actionType || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(counts, actionType)) counts[actionType] += 1;
    }
    return counts;
  }, [filteredAutomationAuditLogs]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditActionFilter, auditActorSearch, auditPageSize, auditPeriod, auditSortOrder]);

  const createCampaign = async () => {
    try {
      await authFetch('/api/marketing/campaign/create', {
        method: 'POST',
        body: JSON.stringify(campaignForm),
      });
      toast({ title: 'Campagne creee', description: 'Brouillon enregistre dans Campaign Manager.' });
      setCampaignForm((p) => ({ ...p, name: '', contentMessage: '' }));
      await loadData();
    } catch (e) {
      toast({ title: 'Creation impossible', description: String(e?.message || e), variant: 'destructive' });
    }
  };

  const suggestCampaignMessage = async () => {
    setAiSuggestLoading(true);
    try {
      const payload = await authFetch('/api/marketing/ai/suggest-message', {
        method: 'POST',
        body: JSON.stringify({
          objective: campaignForm.objective,
          segment: campaignForm.audience,
          tone: 'premium',
        }),
      });
      const first = payload?.suggestions?.[0];
      if (first?.message) {
        setCampaignForm((p) => ({ ...p, contentMessage: first.message }));
      }
      toast({ title: 'Suggestion IA prete', description: 'Message optimise injecte dans la campagne.' });
    } catch (e) {
      toast({ title: 'IA indisponible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setAiSuggestLoading(false);
    }
  };

  const createFunnel = async () => {
    setFunnelSaving(true);
    try {
      await authFetch('/api/marketing/funnel/create', {
        method: 'POST',
        body: JSON.stringify({
          name: funnelForm.name,
          linkedFormationId: funnelForm.linkedFormationId || null,
          steps: [
            { stepType: 'landing', order_index: 1, config: {} },
            { stepType: 'capture', order_index: 2, config: {} },
            { stepType: 'presentation', order_index: 3, config: {} },
            { stepType: 'offer', order_index: 4, config: {} },
            { stepType: 'payment', order_index: 5, config: {} },
            { stepType: 'confirmation', order_index: 6, config: {} },
          ],
        }),
      });
      toast({ title: 'Funnel cree', description: 'Tunnel initial cree avec les 6 etapes standard.' });
      setFunnelForm({ name: '', linkedFormationId: '' });
    } catch (e) {
      toast({ title: 'Funnel error', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setFunnelSaving(false);
    }
  };

  const runAutomation = async () => {
    setRunningAutomation(true);
    try {
      await authFetch('/api/marketing/automation/run', {
        method: 'POST',
        body: JSON.stringify({ trigger: 'lead_created' }),
      });
      toast({ title: 'Automation lancee', description: 'Automation Flow Engine execute sur trigger lead_created.' });
    } catch (e) {
      toast({ title: 'Automation error', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setRunningAutomation(false);
    }
  };

  const resetFlowEditor = useCallback(() => {
    setEditingFlowId(null);
    setFlowForm({ name: '', trigger: 'lead_created', conditionOperator: 'AND' });
    setFlowConditionRules([{ id: 'c-1', type: 'none' }]);
    setFlowActions([{ id: 'a-1', branch: 'yes', actionType: 'send_email' }]);
    setFlowNodePositions({});
  }, []);

  const mapFlowToMutationPayload = useCallback((flow, statusOverride) => {
    const actions = (flow?.actions || []).map((action, idx) => ({
      actionType: action.action_type || 'send_email',
      order_index: Number.isFinite(Number(action.order_index)) ? Number(action.order_index) : idx + 1,
      config: action.config_json || {},
    }));
    return {
      flowId: flow.id,
      name: flow.name || 'Flow',
      trigger: flow.trigger || 'lead_created',
      status: String(statusOverride || flow.status || 'active').toLowerCase(),
      conditions_json: flow.conditions_json || { type: 'none', operator: 'AND', rules: [{ type: 'none' }] },
      actions,
    };
  }, []);

  const createFlow = async () => {
    setFlowSaving(true);
    try {
      const normalizedActions = (flowActions || []).map((a, idx) => ({
        actionType: a.actionType,
        order_index: idx + 1,
        config: {
          branch: a.branch || 'yes',
          title: 'Action auto Prorascience',
          message: 'Flow execute automatiquement.',
        },
      }));
      const endpoint = editingFlowId ? '/api/marketing/automation/update' : '/api/marketing/automation/create';
      await authFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          flowId: editingFlowId || undefined,
          name: flowForm.name,
          trigger: flowForm.trigger,
          status: 'active',
          conditions_json: {
            operator: flowForm.conditionOperator,
            rules: flowConditionRules.map((rule) => ({ type: rule.type })),
            type: flowConditionRules[0]?.type || 'none',
            uiGraph: {
              nodePositions: flowNodePositions,
            },
          },
          actions: normalizedActions,
        }),
      });
      toast({
        title: editingFlowId ? 'Flow mis a jour' : 'Flow cree',
        description: 'Automation Flow Engine mis a jour.',
      });
      resetFlowEditor();
      const flowsRes = await authFetch('/api/marketing/automation/list');
      setFlows(Array.isArray(flowsRes?.flows) ? flowsRes.flows : []);
    } catch (e) {
      toast({ title: 'Flow error', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setFlowSaving(false);
    }
  };

  const duplicateFlow = async (flow) => {
    if (!flow?.id) return;
    markFlowLoading(flow.id, true);
    try {
      await authFetch('/api/marketing/automation/create', {
        method: 'POST',
        body: JSON.stringify({
          name: `${flow.name || 'Flow'} (copie)`,
          trigger: flow.trigger || 'lead_created',
          status: 'active',
          conditions_json: flow.conditions_json || { type: 'none', operator: 'AND', rules: [{ type: 'none' }] },
          actions: mapFlowToMutationPayload(flow).actions,
        }),
      });
      toast({ title: 'Flow duplique', description: 'Une copie active a ete creee.' });
      await loadAutomationData();
    } catch (e) {
      toast({ title: 'Duplication impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      markFlowLoading(flow.id, false);
    }
  };

  const archiveFlow = async (flow) => {
    if (!flow?.id) return;
    markFlowLoading(flow.id, true);
    try {
      await authFetch('/api/marketing/automation/update', {
        method: 'POST',
        body: JSON.stringify(mapFlowToMutationPayload(flow, 'archived')),
      });
      toast({ title: 'Flow archive', description: 'Le flow a ete passe en archive.' });
      if (editingFlowId === flow.id) {
        resetFlowEditor();
      }
      await loadAutomationData();
    } catch (e) {
      toast({ title: 'Archivage impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      markFlowLoading(flow.id, false);
    }
  };

  const pauseFlow = async (flow) => {
    if (!flow?.id) return;
    markFlowLoading(flow.id, true);
    try {
      await authFetch('/api/marketing/automation/update', {
        method: 'POST',
        body: JSON.stringify(mapFlowToMutationPayload(flow, 'paused')),
      });
      toast({ title: 'Flow en pause', description: 'Le flow est temporairement suspendu.' });
      await loadAutomationData();
    } catch (e) {
      toast({ title: 'Pause impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      markFlowLoading(flow.id, false);
    }
  };

  const activateFlow = async (flow) => {
    if (!flow?.id) return;
    markFlowLoading(flow.id, true);
    try {
      await authFetch('/api/marketing/automation/update', {
        method: 'POST',
        body: JSON.stringify(mapFlowToMutationPayload(flow, 'active')),
      });
      toast({ title: 'Flow active', description: 'Le flow est a nouveau actif.' });
      await loadAutomationData();
    } catch (e) {
      toast({ title: 'Activation impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      markFlowLoading(flow.id, false);
    }
  };

  const deleteFlow = async (flow) => {
    if (!flow?.id) return;
    const ok = window.confirm(`Supprimer definitivement le flow "${flow.name}" ?`);
    if (!ok) return;
    markFlowLoading(flow.id, true);
    try {
      await authFetch('/api/marketing/automation/delete', {
        method: 'POST',
        body: JSON.stringify({ flowId: flow.id }),
      });
      toast({ title: 'Flow supprime', description: 'Le flow et ses actions ont ete supprimes.' });
      if (editingFlowId === flow.id) resetFlowEditor();
      await loadAutomationData();
    } catch (e) {
      toast({ title: 'Suppression impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      markFlowLoading(flow.id, false);
    }
  };

  const runFlowNow = async (flow) => {
    if (!flow?.trigger) return;
    markFlowLoading(flow.id, true);
    try {
      await authFetch('/api/marketing/automation/run', {
        method: 'POST',
        body: JSON.stringify({ trigger: flow.trigger }),
      });
      toast({ title: 'Flow execute', description: `Trigger ${flow.trigger} execute manuellement.` });
    } catch (e) {
      toast({ title: 'Execution impossible', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      markFlowLoading(flow.id, false);
    }
  };

  const toggleFlowSelection = useCallback((flowId) => {
    setSelectedFlowIds((prev) => (prev.includes(flowId) ? prev.filter((id) => id !== flowId) : [...prev, flowId]));
  }, []);

  const toggleSelectAllFiltered = useCallback(() => {
    setSelectedFlowIds((prev) => {
      if (!filteredFlowIds.length) return prev;
      const isAllSelected = filteredFlowIds.every((id) => prev.includes(id));
      if (isAllSelected) return prev.filter((id) => !filteredFlowIds.includes(id));
      const merged = new Set([...prev, ...filteredFlowIds]);
      return Array.from(merged);
    });
  }, [filteredFlowIds]);

  const exportFilteredFlowsCsv = useCallback(() => {
    if (!filteredFlows.length) {
      toast({ title: 'Export CSV', description: 'Aucun flow a exporter.' });
      return;
    }
    const headers = ['id', 'name', 'trigger', 'status', 'condition_operator', 'rules_count', 'actions_count', 'updated_at'];
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = filteredFlows.map((flow) =>
      [
        flow.id,
        flow.name || '',
        flow.trigger || '',
        flow.status || '',
        flow.conditions_json?.operator || flow.conditions_json?.type || 'none',
        flow.conditions_json?.rules?.length || (flow.conditions_json?.type ? 1 : 0),
        flow.actions?.length || 0,
        flow.updated_at || flow.created_at || '',
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `marketing-flows-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredFlows, toast]);

  const runBulkFlowAction = useCallback(
    async (actionType, explicitFlowIds = null) => {
      const targetIds = Array.isArray(explicitFlowIds) && explicitFlowIds.length ? explicitFlowIds : selectedFlowIds;
      if (!targetIds.length) {
        toast({ title: 'Action en lot', description: 'Selectionnez au moins un flow.' });
        return;
      }
      const targets = (flows || []).filter((flow) => targetIds.includes(flow.id));
      if (!targets.length) return;

      if (actionType === 'delete') {
        const ok = window.confirm(`Supprimer ${targets.length} flow(s) definitivement ?`);
        if (!ok) return;
      }

      setBulkLoading(true);
      try {
        const results = await Promise.allSettled(
          targets.map(async (flow) => {
            if (actionType === 'run') {
              return authFetch('/api/marketing/automation/run', {
                method: 'POST',
                body: JSON.stringify({ trigger: flow.trigger }),
              });
            }
            if (actionType === 'delete') {
              return authFetch('/api/marketing/automation/delete', {
                method: 'POST',
                body: JSON.stringify({ flowId: flow.id }),
              });
            }
            const nextStatus =
              actionType === 'pause' ? 'paused' : actionType === 'activate' ? 'active' : actionType === 'archive' ? 'archived' : null;
            if (!nextStatus) return null;
            return authFetch('/api/marketing/automation/update', {
              method: 'POST',
              body: JSON.stringify(mapFlowToMutationPayload(flow, nextStatus)),
            });
          })
        );
        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failCount = results.length - successCount;
        const items = results.map((result, idx) => {
          const flow = targets[idx];
          return {
            flowId: flow?.id,
            flowName: flow?.name || flow?.id || 'Flow',
            success: result.status === 'fulfilled',
            error: result.status === 'rejected' ? String(result.reason?.message || result.reason || 'Erreur') : '',
          };
        });
        setBulkReport({
          actionType,
          createdAt: new Date().toISOString(),
          total: results.length,
          successCount,
          failCount,
          items,
        });
        await authFetch('/api/marketing/automation/audit', {
          method: 'POST',
          body: JSON.stringify({
            actionType,
            selectedFlowIds: targetIds,
            total: results.length,
            successCount,
            failCount,
          }),
        });
        toast({
          title: 'Action en lot terminee',
          description: `${successCount} succes, ${failCount} echec(s).`,
          variant: failCount ? 'destructive' : undefined,
        });
        if (targetIds.includes(editingFlowId)) resetFlowEditor();
        setSelectedFlowIds([]);
        await loadAutomationData();
      } catch (e) {
        toast({ title: 'Action en lot impossible', description: String(e?.message || e), variant: 'destructive' });
      } finally {
        setBulkLoading(false);
      }
    },
    [authFetch, editingFlowId, flows, loadAutomationData, mapFlowToMutationPayload, resetFlowEditor, selectedFlowIds, toast]
  );

  const exportAuditCsv = useCallback(() => {
    if (!filteredAutomationAuditLogs.length) {
      toast({ title: 'Export audit', description: 'Aucun journal a exporter.' });
      return;
    }
    const headers = ['created_at', 'action', 'result', 'actor_email', 'actor_role', 'total', 'success', 'failed', 'flow_ids'];
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = sortedAutomationAuditLogs.map((log) => {
      const payload = log.payload_json && typeof log.payload_json === 'object' ? log.payload_json : {};
      return [
        log.created_at || '',
        log.action || '',
        log.result || '',
        payload.actorEmail || '',
        payload.actorRole || '',
        payload.total || '',
        payload.successCount || '',
        payload.failCount || '',
        Array.isArray(payload.selectedFlowIds) ? payload.selectedFlowIds.join('|') : '',
      ]
        .map(escapeCsv)
        .join(',');
    });
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `automation-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [sortedAutomationAuditLogs, toast]);

  const exportBulkReportCsv = useCallback(() => {
    if (!bulkReport?.items?.length) {
      toast({ title: 'Export bulk', description: 'Aucun rapport bulk a exporter.' });
      return;
    }
    const headers = ['action_type', 'flow_id', 'flow_name', 'success', 'error'];
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = bulkReport.items.map((item) =>
      [bulkReport.actionType || '', item.flowId || '', item.flowName || '', item.success ? 'yes' : 'no', item.error || '']
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `automation-bulk-report-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [bulkReport, toast]);

  const retryBulkFailures = useCallback(async () => {
    const failedIds = (bulkReport?.items || []).filter((item) => !item.success).map((item) => item.flowId).filter(Boolean);
    if (!failedIds.length) {
      toast({ title: 'Retenter echecs', description: 'Aucun echec a retenter.' });
      return;
    }
    await runBulkFlowAction(bulkReport?.actionType || 'run', failedIds);
  }, [bulkReport, runBulkFlowAction, toast]);

  const resetKbForm = useCallback(() => {
    setKbForm({
      id: '',
      title: '',
      content: '',
      source_type: 'manual',
      source_url: '',
      intents: '',
      keywords: '',
      priority: 50,
      is_active: true,
    });
  }, []);

  const saveKnowledgeEntry = useCallback(async () => {
    if (!kbForm.title.trim() || !kbForm.content.trim()) {
      toast({ title: 'Knowledge Base', description: 'Titre et contenu sont requis.' });
      return;
    }
    setKbSaving(true);
    try {
      await authFetch('/api/response/kb/upsert', {
        method: 'POST',
        body: JSON.stringify({
          id: kbForm.id || undefined,
          title: kbForm.title,
          content: kbForm.content,
          source_type: kbForm.source_type,
          source_url: kbForm.source_url || null,
          intents: kbForm.intents,
          keywords: kbForm.keywords,
          priority: Number(kbForm.priority || 50),
          is_active: Boolean(kbForm.is_active),
        }),
      });
      toast({ title: 'Knowledge Base', description: kbForm.id ? 'Entree mise a jour.' : 'Entree ajoutee.' });
      resetKbForm();
      await loadKnowledgeBase();
    } catch (e) {
      toast({ title: 'Knowledge Base', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setKbSaving(false);
    }
  }, [authFetch, kbForm, loadKnowledgeBase, resetKbForm, toast]);

  const [pendingDeleteKbId, setPendingDeleteKbId] = useState(null);

  const removeKnowledgeEntry = useCallback(
    async (entryId) => {
      if (pendingDeleteKbId === entryId) {
        setPendingDeleteKbId(null);
        try {
          await authFetch('/api/response/kb/delete', {
            method: 'POST',
            body: JSON.stringify({ id: entryId }),
          });
          toast({ title: 'Knowledge Base', description: 'Entrée supprimée.' });
          await loadKnowledgeBase();
        } catch (e) {
          toast({ title: 'Knowledge Base', description: String(e?.message || e), variant: 'destructive' });
        }
      } else {
        setPendingDeleteKbId(entryId);
        setTimeout(() => setPendingDeleteKbId((prev) => (prev === entryId ? null : prev)), 4000);
        toast({ title: 'Confirmer la suppression', description: 'Cliquez à nouveau sur "Supprimer" pour confirmer.' });
      }
    },
    [authFetch, loadKnowledgeBase, pendingDeleteKbId, toast]
  );

  const ingestFromLlmsFile = useCallback(async () => {
    setKbImporting(true);
    try {
      const res = await fetch('/llms.txt', { method: 'GET' });
      if (!res.ok) throw new Error('Impossible de lire /llms.txt');
      const rawText = await res.text();
      if (!rawText.trim()) throw new Error('Le fichier llms.txt est vide.');
      const ingest = await authFetch('/api/response/kb/ingest', {
        method: 'POST',
        body: JSON.stringify({
          sourceLabel: 'llms.txt',
          sourceUrl: '/llms.txt',
          rawText,
        }),
      });
      toast({
        title: 'Scan du site termine',
        description: `${ingest?.inserted || 0} segments importes depuis llms.txt`,
      });
      await loadKnowledgeBase();
    } catch (e) {
      toast({ title: 'Scan du site', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setKbImporting(false);
    }
  }, [authFetch, loadKnowledgeBase, toast]);

  return (
    <div className="space-y-6 overflow-x-hidden min-w-0 max-w-full">
      <div className="premium-panel p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-[var(--school-accent)]" />
            PRORASCIENCE Growth Engine
          </h1>
          <p className="text-sm text-gray-400 mt-1">Campaigns, funnels, leads, automation et analytics connectes au booking/paiement.</p>
        </div>
        <Button
          variant="outline"
          className="border-white/10 text-white hover:bg-white/5"
          onClick={() => {
            void loadData();
            void loadAutomationData();
          }}
          disabled={loading || automationTabLoading}
        >
          {loading || automationTabLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Actualiser
        </Button>
      </div>

      {import.meta.env.DEV ? (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <strong className="text-emerald-50">Moteur CRM :</strong> les routes marketing sont désormais servies par l’API NestJS{' '}
          <code className="rounded bg-black/30 px-1 text-xs">api.cimolace.space/marketing/*</code> (tenant-scopé via{' '}
          <code className="rounded bg-black/30 px-1 text-xs">X-Tenant-Slug</code>). Le backend Netlify est retiré.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-white/15 text-white hover:bg-white/10"
          onClick={() => setTab('automation')}
        >
          <Workflow className="w-4 h-4 mr-2 text-violet-300" />
          Ouvrir Automation (flows)
        </Button>
        <Button asChild variant="outline" className="border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]">
          <Link to="/appointment/request">
            <CalendarDays className="w-4 h-4 mr-2" />
            Calendrier public — prise de RDV
          </Link>
        </Button>
      </div>

      <div className="overflow-x-auto pb-1">
        <PremiumSegmentedSelector
          value={tab}
          onChange={setTab}
          options={[
            { value: 'campaigns', label: 'Campagnes', badge: 'Growth' },
            { value: 'funnels', label: 'Funnels', badge: 'SaaS' },
            { value: 'leads', label: 'Leads', badge: `${leads.length}` },
            { value: 'logs', label: 'Logs', badge: `${marketingLogs.length}` },
            { value: 'automation', label: 'Automation', badge: 'Flows' },
            { value: 'response', label: 'Chatbot KB', badge: `${kbEntries.length}` },
            { value: 'orchestration', label: 'Orchestration', badge: 'Auto' },
          { value: 'analytics', label: 'Analytics', badge: 'KPIs' },
          { value: 'channels', label: 'Canaux', badge: 'Intégrations' },
        ]}
        layoutId="admin-growth-tabs"
        compact
        className="min-w-max"
        />
      </div>

      {tab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="premium-panel p-5 space-y-3">
            <h2 className="text-white font-semibold">Nouvelle campagne</h2>
          {/* Formulaire de création de campagne */}
            <Input placeholder="Nom campagne" value={campaignForm.name} onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                value={campaignForm.objective}
                onChange={(e) => setCampaignForm((p) => ({ ...p, objective: e.target.value }))}
              >
                {objectiveOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Input placeholder="Canal (email)" value={campaignForm.channel} onChange={(e) => setCampaignForm((p) => ({ ...p, channel: e.target.value }))} />
            </div>
            <Input placeholder="Audience (ex: nouveaux_prospects)" value={campaignForm.audience} onChange={(e) => setCampaignForm((p) => ({ ...p, audience: e.target.value }))} />
            <Textarea placeholder="Message de campagne" value={campaignForm.contentMessage} onChange={(e) => setCampaignForm((p) => ({ ...p, contentMessage: e.target.value }))} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={suggestCampaignMessage} disabled={aiSuggestLoading}>
                {aiSuggestLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Suggestion IA
              </Button>
              <Button className="bg-[var(--school-accent)] text-black hover:bg-amber-500" onClick={createCampaign}>Creer campagne</Button>
            </div>
          </div>
          <div className="premium-panel p-5 space-y-2">
            <h2 className="text-white font-semibold">État global</h2>
            <div className="text-sm text-gray-300">Actives : <span className="text-emerald-300 font-bold">{analytics?.campaigns?.active || 0}</span></div>
            <div className="text-sm text-gray-300">En pause : <span className="text-amber-300 font-bold">{analytics?.campaigns?.paused || 0}</span></div>
            <div className="text-sm text-gray-300">Terminées : <span className="text-blue-300 font-bold">{analytics?.campaigns?.completed || 0}</span></div>
          </div>
        </div>
      )}

      {tab === 'funnels' && (
        <div className="premium-panel p-5 space-y-3">
          <h2 className="text-white font-semibold flex items-center gap-2"><GitBranch className="w-4 h-4 text-[var(--school-accent)]" /> Funnel Builder Engine</h2>
          <Input placeholder="Nom funnel" value={funnelForm.name} onChange={(e) => setFunnelForm((p) => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Formation liee (UUID optionnel)" value={funnelForm.linkedFormationId} onChange={(e) => setFunnelForm((p) => ({ ...p, linkedFormationId: e.target.value }))} />
          <Button className="bg-[var(--school-accent)] text-black hover:bg-amber-500" onClick={createFunnel} disabled={funnelSaving}>
            {funnelSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Creer funnel standard
          </Button>
          <div className="space-y-2 pt-2">
            {(funnels || []).slice(0, 8).map((f) => (
              <div key={f.id} className="rounded-lg border border-white/10 p-3 bg-[#0F1419]/70">
                <p className="text-sm text-white">{f.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  etapes {f.steps?.length || 0} | conversion {f.performance?.conversionRate || 0}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="premium-panel p-5 space-y-3">
          <h2 className="text-white font-semibold">Gestion des Leads (CRM)</h2>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30">Total : {leads.length}</Badge>
            <Badge className="bg-red-500/20 text-red-200 border-red-500/30">❄ Froids : {heatBreakdown.cold}</Badge>
            <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/30">~ Tièdes : {heatBreakdown.warm}</Badge>
            <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30">🔥 Chauds : {heatBreakdown.hot}</Badge>
          </div>
          <div className="space-y-2">
            {leads.slice(0, 30).map((lead) => (
              <div key={lead.id} className="rounded-lg border border-white/10 p-3 bg-[#0F1419]/70">
                <p className="text-sm text-white">{lead.name || lead.email || lead.phone || 'Lead'}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {lead.email || '-'} | score {lead.score} | status {lead.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="premium-panel p-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-white font-semibold">Logs (audit marketing)</h2>
              <p className="text-sm text-gray-400 mt-1">Filtrés automatiquement par tenant si disponible.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
              onClick={() => void loadLogs()}
              disabled={logsLoading}
            >
              {logsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Rafraîchir
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="action_prefix (ex: automation_, campaign_, lead_, payment_)"
              value={logsActionPrefix}
              onChange={(e) => {
                setLogsPage(1);
                setLogsActionPrefix(e.target.value);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
              onClick={() => void loadLogs()}
              disabled={logsLoading}
            >
              Filtrer
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500">
              Page {logsPage} · {logsPageSize} / page
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                disabled={logsLoading || logsPage <= 1}
              >
                Précédent
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={() => setLogsPage((p) => p + 1)}
                disabled={logsLoading || marketingLogs.length < logsPageSize}
              >
                Suivant
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {marketingLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-white/10 p-3 bg-[#0F1419]/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-white font-mono">{log.action}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="border-white/10 text-white hover:bg-white/5 h-8 w-8 shrink-0"
                      onClick={() => void copyMarketingLogPayload(log)}
                      aria-label="Copier payload_json"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Badge className="bg-white/5 text-white/70 border-white/10">{log.result || '-'}</Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  {log.created_at || '-'} · tenant {log.cimolace_tenant_id || '-'} · lead {log.lead_id || '-'} · campaign{' '}
                  {log.campaign_id || '-'}
                  {log.channel ? ` · channel ${log.channel}` : ''}
                </p>
                {log.payload_json && typeof log.payload_json === 'object' && Object.keys(log.payload_json).length ? (
                  <pre className="mt-2 max-h-32 overflow-auto rounded border border-white/10 bg-black/30 p-2 text-[11px] text-gray-300 font-mono leading-relaxed">
                    {JSON.stringify(log.payload_json, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
            {!marketingLogs.length && !logsLoading ? <p className="text-sm text-gray-500">Aucun log.</p> : null}
          </div>
        </div>
      )}

      {tab === 'response' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">
          <div className="premium-panel p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-white font-semibold">Knowledge Base Chatbot</h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/5"
                  onClick={loadKnowledgeBase}
                  disabled={kbLoading}
                >
                  {kbLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Recharger
                </Button>
                <Button
                  className="bg-[var(--school-accent)] text-black hover:bg-amber-500"
                  onClick={ingestFromLlmsFile}
                  disabled={kbImporting}
                >
                  {kbImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Scanner le site (llms.txt)
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-400">
              Ajoute des connaissances manuelles et importe automatiquement les contenus globaux du site depuis <code>llms.txt</code>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr,180px] gap-2">
              <Input placeholder="Rechercher (titre, contenu, keywords)" value={kbSearch} onChange={(e) => setKbSearch(e.target.value)} />
              <select
                className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                value={kbOnlyActive ? 'active' : 'all'}
                onChange={(e) => setKbOnlyActive(e.target.value === 'active')}
              >
                <option value="active">Actifs uniquement</option>
                <option value="all">Tous</option>
              </select>
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {(kbEntries || []).map((entry) => (
                <div key={entry.id} className="rounded-lg border border-white/10 p-3 bg-[#0F1419]/70 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-white font-medium">{entry.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge className={entry.is_active ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' : 'bg-zinc-500/20 text-zinc-200 border-zinc-500/30'}>
                        {entry.is_active ? 'active' : 'inactive'}
                      </Badge>
                      <Badge className="bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]">P{entry.priority}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-gray-300 line-clamp-2">{entry.content}</p>
                  <p className="text-xs text-gray-500">
                    {entry.source_type}
                    {entry.source_url ? ` | ${entry.source_url}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="h-8 border-white/10 text-white hover:bg-white/5"
                      onClick={() =>
                        setKbForm({
                          id: entry.id,
                          title: entry.title || '',
                          content: entry.content || '',
                          source_type: entry.source_type || 'manual',
                          source_url: entry.source_url || '',
                          intents: Array.isArray(entry.intents) ? entry.intents.join(', ') : '',
                          keywords: Array.isArray(entry.keywords) ? entry.keywords.join(', ') : '',
                          priority: Number(entry.priority || 50),
                          is_active: entry.is_active !== false,
                        })
                      }
                    >
                      Editer
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-8 transition-all ${pendingDeleteKbId === entry.id ? 'border-red-500 text-red-100 bg-red-500/20 animate-pulse' : 'border-red-400/30 text-red-200 hover:bg-red-500/10'}`}
                      onClick={() => removeKnowledgeEntry(entry.id)}
                    >
                      {pendingDeleteKbId === entry.id ? 'Confirmer ?' : 'Supprimer'}
                    </Button>
                  </div>
                </div>
              ))}
              {!kbEntries.length && !kbLoading && (
                <div className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-gray-400">
                  Aucune entree. Ajoute du contenu manuel ou lance le scan du site.
                </div>
              )}
            </div>
          </div>

          <div className="premium-panel p-5 space-y-3">
            <h3 className="text-white font-semibold">{kbForm.id ? 'Modifier entree' : 'Nouvelle entree'}</h3>
            <Input placeholder="Titre" value={kbForm.title} onChange={(e) => setKbForm((p) => ({ ...p, title: e.target.value }))} />
            <Textarea
              placeholder="Contenu de connaissance (FAQ, explication, procedure...)"
              value={kbForm.content}
              onChange={(e) => setKbForm((p) => ({ ...p, content: e.target.value }))}
              className="min-h-[180px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                value={kbForm.source_type}
                onChange={(e) => setKbForm((p) => ({ ...p, source_type: e.target.value }))}
              >
                <option value="manual">manual</option>
                <option value="faq">faq</option>
                <option value="docs">docs</option>
                <option value="site_scan">site_scan</option>
              </select>
              <Input
                type="number"
                min={1}
                max={100}
                placeholder="Priorite 1-100"
                value={kbForm.priority}
                onChange={(e) => setKbForm((p) => ({ ...p, priority: Number(e.target.value || 50) }))}
              />
            </div>
            <Input placeholder="Source URL (optionnel)" value={kbForm.source_url} onChange={(e) => setKbForm((p) => ({ ...p, source_url: e.target.value }))} />
            <Input placeholder="Intents (csv) ex: pricing, booking" value={kbForm.intents} onChange={(e) => setKbForm((p) => ({ ...p, intents: e.target.value }))} />
            <Input placeholder="Keywords (csv) ex: talisman, libation" value={kbForm.keywords} onChange={(e) => setKbForm((p) => ({ ...p, keywords: e.target.value }))} />
            <select
              className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
              value={kbForm.is_active ? 'yes' : 'no'}
              onChange={(e) => setKbForm((p) => ({ ...p, is_active: e.target.value === 'yes' }))}
            >
              <option value="yes">Active</option>
              <option value="no">Inactive</option>
            </select>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-[var(--school-accent)] text-black hover:bg-amber-500" onClick={saveKnowledgeEntry} disabled={kbSaving}>
                {kbSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {kbForm.id ? 'Mettre a jour' : 'Ajouter a la KB'}
              </Button>
              <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={resetKbForm}>
                Reinitialiser
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'automation' && (
        <div className="space-y-4 min-w-0 max-w-full overflow-x-clip">
          {automationTabLoading && flows.length === 0 ? (
            <div className="premium-panel p-6 flex items-center gap-3 text-gray-300">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--school-accent)]" />
              Chargement des flows et du journal d&apos;audit…
            </div>
          ) : null}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start min-w-0 max-w-full">
            <div className="premium-panel p-5 space-y-3 min-w-0 max-w-full overflow-hidden">
          <h2 className="text-white font-semibold flex items-center gap-2 flex-wrap"><Workflow className="w-4 h-4 text-[var(--school-accent)] shrink-0" /> Automation Flow Engine</h2>
          <p className="text-sm text-gray-400">Trigger → Condition → Action. Les données flows/audit se chargent à l&apos;ouverture de cet onglet (pas tout le tableau d&apos;un coup).</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
              value={editingFlowId || ''}
              onChange={(e) => {
                const value = e.target.value || '';
                if (!value) {
                  resetFlowEditor();
                  return;
                }
                const selectedFlow = flows.find((f) => f.id === value);
                if (!selectedFlow) return;
                loadFlowIntoEditor(selectedFlow);
              }}
            >
              <option value="">Nouveau flow</option>
              {(flows || []).map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
              onClick={resetFlowEditor}
            >
              Reinitialiser editeur
            </Button>
          </div>
          <Input placeholder="Nom flow" value={flowForm.name} onChange={(e) => setFlowForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30">Actifs: {automationStats.active}</Badge>
            <Badge className="bg-violet-500/20 text-violet-200 border-violet-500/30">Pause: {automationStats.paused}</Badge>
            <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/30">Archives: {automationStats.archived}</Badge>
            <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30">Total: {automationStats.total}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
              value={automationStatusFilter}
              onChange={(e) => setAutomationStatusFilter(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="paused">Pause</option>
              <option value="archived">Archives</option>
            </select>
            <Input
              placeholder="Rechercher un flow (nom/trigger/statut)"
              value={automationSearch}
              onChange={(e) => setAutomationSearch(e.target.value)}
            />
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0B1017] p-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge className="bg-white/10 text-gray-200 border-white/10">Selection: {selectedFlowCount}</Badge>
              <label className="inline-flex items-center gap-2 text-xs text-gray-300 border border-white/10 rounded px-2 py-1">
                <input
                  type="checkbox"
                  checked={automationAutoRefresh}
                  onChange={(e) => setAutomationAutoRefresh(Boolean(e.target.checked))}
                  disabled={bulkLoading}
                />
                Auto-refresh 45s
              </label>
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={toggleSelectAllFiltered}
                disabled={bulkLoading || !filteredFlows.length}
              >
                {allFilteredSelected ? 'Deselectionner filtres' : 'Selectionner filtres'}
              </Button>
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={() => setSelectedFlowIds([])}
                disabled={bulkLoading || !selectedFlowCount}
              >
                Vider selection
              </Button>
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={exportFilteredFlowsCsv}
                disabled={bulkLoading || !filteredFlows.length}
              >
                Export CSV (filtres)
              </Button>
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={exportAuditCsv}
                disabled={bulkLoading || !filteredAutomationAuditLogs.length}
              >
                Export CSV (audit)
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-blue-600 text-white hover:bg-blue-500" onClick={() => runBulkFlowAction('run')} disabled={bulkLoading || !selectedFlowCount}>
                Executer lot
              </Button>
              <Button className="bg-violet-600 text-white hover:bg-violet-500" onClick={() => runBulkFlowAction('pause')} disabled={bulkLoading || !selectedFlowCount}>
                Pause lot
              </Button>
              <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => runBulkFlowAction('activate')} disabled={bulkLoading || !selectedFlowCount}>
                Reactiver lot
              </Button>
              <Button className="bg-amber-600 text-white hover:bg-amber-500" onClick={() => runBulkFlowAction('archive')} disabled={bulkLoading || !selectedFlowCount}>
                Archiver lot
              </Button>
              <Button className="bg-red-600 text-white hover:bg-red-500" onClick={() => runBulkFlowAction('delete')} disabled={bulkLoading || !selectedFlowCount}>
                Supprimer lot
              </Button>
              {bulkLoading ? <span className="text-xs text-gray-400 self-center">Traitement en lot...</span> : null}
            </div>
            {bulkReport?.items?.length ? (
              <div className="rounded border border-white/10 bg-[#0F1419]/70 p-2 space-y-2">
                <p className="text-xs text-gray-200">
                  Rapport bulk: {bulkReport.actionType} | total {bulkReport.total} | ok {bulkReport.successCount} | ko {bulkReport.failCount}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={exportBulkReportCsv}>
                    Export CSV (rapport bulk)
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 text-white hover:bg-white/5"
                    onClick={retryBulkFailures}
                    disabled={bulkLoading || !bulkReport.failCount}
                  >
                    Retenter uniquement les echecs
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-white/10 bg-[#0B1017]/40">
          <AutomationFlowCanvas
            trigger={flowForm.trigger}
            conditionOperator={flowForm.conditionOperator}
            conditionRules={flowConditionRules}
            actions={flowActions}
            nodePositions={flowNodePositions}
            onChangeTrigger={(v) => setFlowForm((p) => ({ ...p, trigger: v }))}
            onChangeConditionOperator={(v) => setFlowForm((p) => ({ ...p, conditionOperator: v }))}
            onAddConditionRule={() =>
              setFlowConditionRules((prev) => [
                ...prev,
                { id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'score_hot' },
              ])
            }
            onUpdateConditionRule={(id, patch) =>
              setFlowConditionRules((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
            }
            onRemoveConditionRule={(id) =>
              setFlowConditionRules((prev) => {
                const filtered = prev.filter((c) => c.id !== id);
                return filtered.length ? filtered : [{ id: 'c-1', type: 'none' }];
              })
            }
            onAddAction={(branch) =>
              setFlowActions((prev) => [
                ...prev,
                { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, branch, actionType: 'send_email' },
              ])
            }
            onRemoveAction={(id) => setFlowActions((prev) => prev.filter((a) => a.id !== id))}
            onUpdateAction={(id, patch) =>
              setFlowActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
            }
            onNodePositionsChange={setFlowNodePositions}
          />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
          <Button
            className="bg-[var(--school-accent)] text-black hover:bg-amber-500"
            onClick={createFlow}
            disabled={flowSaving || !flowForm.name.trim() || !flowActions.length}
          >
            {flowSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {editingFlowId ? 'Mettre a jour flow' : 'Creer flow'}
          </Button>
          <Button className="bg-[var(--school-accent)] text-black hover:bg-amber-500" onClick={runAutomation} disabled={runningAutomation}>
            {runningAutomation ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Executer trigger {flowForm.trigger || 'lead_created'}
          </Button>
          </div>
            </div>

            <div className="premium-panel p-5 min-w-0 flex flex-col gap-3 overflow-hidden xl:sticky xl:top-24" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              <h3 className="text-white font-semibold text-sm border-b border-white/10 pb-2">Flows ({filteredFlows.length})</h3>
          <div className="space-y-2 flex-1 overflow-y-auto min-h-0 pr-1">
            {paginatedFlows.map((flow) => (
              <div key={flow.id} className="rounded-lg border border-white/10 p-3 bg-[#0F1419]/70">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-white">{flow.name}</p>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={selectedFlowIds.includes(flow.id)}
                      onChange={() => toggleFlowSelection(flow.id)}
                      disabled={bulkLoading}
                    />
                    Select
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  trigger {flow.trigger} | condition {flow.conditions_json?.operator || flow.conditions_json?.type || 'none'} | regles {flow.conditions_json?.rules?.length || (flow.conditions_json?.type ? 1 : 0)} | actions {(flow.actions || []).length} | status {flow.status}
                </p>
                <div className="mt-2">
                  <Badge className="bg-white/10 text-gray-200 border-white/10">Statut: {flow.status || 'active'}</Badge>
                  {flowActionLoading[flow.id] ? <span className="ml-2 text-[11px] text-gray-400">Traitement...</span> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-[11px] px-2 py-1 rounded border border-white/20 text-white hover:bg-white/5"
                    onClick={() => {
                      loadFlowIntoEditor(flow);
                    }}
                    disabled={flowActionLoading[flow.id] || bulkLoading}
                  >
                    Charger dans l'editeur
                  </button>
                  <button
                    type="button"
                    className="text-[11px] px-2 py-1 rounded border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/10"
                    onClick={() => duplicateFlow(flow)}
                    disabled={flowActionLoading[flow.id] || bulkLoading}
                  >
                    Dupliquer
                  </button>
                  <button
                    type="button"
                    className="text-[11px] px-2 py-1 rounded border border-blue-400/30 text-blue-200 hover:bg-blue-500/10"
                    onClick={() => runFlowNow(flow)}
                    disabled={flowActionLoading[flow.id] || bulkLoading}
                  >
                    Executer
                  </button>
                  {flow.status === 'active' ? (
                    <button
                      type="button"
                      className="text-[11px] px-2 py-1 rounded border border-violet-400/30 text-violet-200 hover:bg-violet-500/10"
                      onClick={() => pauseFlow(flow)}
                      disabled={flowActionLoading[flow.id] || bulkLoading}
                    >
                      Pause
                    </button>
                  ) : null}
                  {flow.status === 'paused' || flow.status === 'archived' ? (
                    <button
                      type="button"
                      className="text-[11px] px-2 py-1 rounded border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/10"
                      onClick={() => activateFlow(flow)}
                      disabled={flowActionLoading[flow.id] || bulkLoading}
                    >
                      Reactiver
                    </button>
                  ) : null}
                  {flow.status !== 'archived' ? (
                    <button
                      type="button"
                      className="text-[11px] px-2 py-1 rounded border border-amber-400/30 text-amber-200 hover:bg-amber-500/10"
                      onClick={() => archiveFlow(flow)}
                      disabled={flowActionLoading[flow.id] || bulkLoading}
                    >
                      Archiver
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-[11px] px-2 py-1 rounded border border-red-400/40 text-red-200 hover:bg-red-500/10"
                    onClick={() => deleteFlow(flow)}
                    disabled={flowActionLoading[flow.id] || bulkLoading}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
            {!filteredFlows.length ? (
              <div className="rounded-lg border border-white/10 p-4 bg-[#0F1419]/70 text-sm text-gray-400">
                Aucun flow ne correspond aux filtres actuels.
              </div>
            ) : null}
            {filteredFlows.length > flowListPageSize ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
                <p className="text-xs text-gray-400">
                  Page flows {Math.min(flowListPage, flowListTotalPages)} / {flowListTotalPages} ({filteredFlows.length} au total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-white hover:bg-white/5"
                    onClick={() => setFlowListPage((p) => Math.max(1, p - 1))}
                    disabled={flowListPage <= 1}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-white hover:bg-white/5"
                    onClick={() => setFlowListPage((p) => Math.min(flowListTotalPages, p + 1))}
                    disabled={flowListPage >= flowListTotalPages}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0F1419]/70 p-3 space-y-2 mt-2 overflow-y-auto max-h-[40vh] min-h-0">
            <p className="text-sm text-white">Journal audit automation (recent)</p>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <Badge className="bg-white/10 text-gray-200 border-white/10">Logs: {filteredAutomationAuditLogs.length}</Badge>
              <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30">run {auditActionCounts.run}</Badge>
              <Badge className="bg-violet-500/20 text-violet-200 border-violet-500/30">pause {auditActionCounts.pause}</Badge>
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30">activate {auditActionCounts.activate}</Badge>
              <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/30">archive {auditActionCounts.archive}</Badge>
              <Badge className="bg-red-500/20 text-red-200 border-red-500/30">delete {auditActionCounts.delete}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                value={auditPeriod}
                onChange={(e) => setAuditPeriod(e.target.value)}
              >
                <option value="7d">7 jours</option>
                <option value="30d">30 jours</option>
                <option value="90d">90 jours</option>
                <option value="180d">180 jours</option>
                <option value="all">Tout</option>
              </select>
              <select
                className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
              >
                <option value="all">Toutes actions</option>
                <option value="run">run</option>
                <option value="pause">pause</option>
                <option value="activate">activate</option>
                <option value="archive">archive</option>
                <option value="delete">delete</option>
              </select>
              <Input
                placeholder="Filtrer acteur (email/role/id)"
                value={auditActorSearch}
                onChange={(e) => setAuditActorSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                value={auditSortOrder}
                onChange={(e) => setAuditSortOrder(e.target.value)}
              >
                <option value="desc">Plus recents</option>
                <option value="asc">Plus anciens</option>
              </select>
              <select
                className="bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-sm text-white"
                value={String(auditPageSize)}
                onChange={(e) => setAuditPageSize(Number(e.target.value) || 8)}
              >
                <option value="8">8 / page</option>
                <option value="12">12 / page</option>
                <option value="20">20 / page</option>
              </select>
            </div>
            {(paginatedAutomationAuditLogs || []).map((log) => {
              const payload = log.payload_json && typeof log.payload_json === 'object' ? log.payload_json : {};
              return (
                <div key={log.id} className="rounded border border-white/10 bg-[#0B1017] p-2">
                  <p className="text-xs text-gray-200">
                    {log.action} - {log.result || 'n/a'}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {payload.actorEmail || payload.actorUserId || 'unknown'} | total {payload.total || 0} | ok {payload.successCount || 0} | ko {payload.failCount || 0}
                  </p>
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-400">
                Page {Math.min(auditPage, auditTotalPages)} / {auditTotalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/5"
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPage <= 1}
                >
                  Precedent
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/5"
                  onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                  disabled={auditPage >= auditTotalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
            {!filteredAutomationAuditLogs.length ? <p className="text-xs text-gray-500">Aucun log audit pour ces filtres.</p> : null}
          </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-4">
          <div className="premium-panel p-5">
            <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[var(--school-accent)]" />
              Conversion Analytics Engine
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Taux de conversion', value: `${analytics?.metrics?.conversionRate || 0}%`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                { label: 'Open rate email', value: `${analytics?.metrics?.openRate || 0}%`, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                { label: 'Click rate', value: `${analytics?.metrics?.clickRate || 0}%`, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
                { label: 'Revenus générés', value: `${analytics?.metrics?.revenue || 0} €`, color: 'text-[var(--school-accent)]', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
              ].map((kpi) => (
                <div key={kpi.label} className={`rounded-xl ${kpi.bg} border ${kpi.border} p-4`}>
                  <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#0F1419]/70 border border-white/10 p-4">
                <p className="text-xs text-gray-400 mb-2">Leads par segment</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">🔥 Chauds (score ≥ 70)</span>
                    <span className="text-xs font-bold text-emerald-400">{heatBreakdown.hot}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: leads.length ? `${(heatBreakdown.hot / leads.length) * 100}%` : '0%' }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">~ Tièdes (35-70)</span>
                    <span className="text-xs font-bold text-amber-400">{heatBreakdown.warm}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: leads.length ? `${(heatBreakdown.warm / leads.length) * 100}%` : '0%' }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">❄ Froids (&lt; 35)</span>
                    <span className="text-xs font-bold text-blue-400">{heatBreakdown.cold}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: leads.length ? `${(heatBreakdown.cold / leads.length) * 100}%` : '0%' }} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-[#0F1419]/70 border border-white/10 p-4">
                <p className="text-xs text-gray-400 mb-2">Automation flows</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">Actifs</span>
                    <span className="text-xs font-bold text-emerald-400">{automationStats.active}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">En pause</span>
                    <span className="text-xs font-bold text-violet-400">{automationStats.paused}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">Archivés</span>
                    <span className="text-xs font-bold text-gray-400">{automationStats.archived}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-1">
                    <span className="text-xs text-gray-300">Total flows</span>
                    <span className="text-xs font-bold text-white">{automationStats.total}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-[#0F1419]/70 border border-white/10 p-4">
                <p className="text-xs text-gray-400 mb-2">Campagnes</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">Actives</span>
                    <span className="text-xs font-bold text-emerald-400">{analytics?.campaigns?.active || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">En pause</span>
                    <span className="text-xs font-bold text-amber-400">{analytics?.campaigns?.paused || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">Terminées</span>
                    <span className="text-xs font-bold text-blue-400">{analytics?.campaigns?.completed || 0}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-1">
                    <span className="text-xs text-gray-300">KB entrées</span>
                    <span className="text-xs font-bold text-white">{kbEntries.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'channels' && (
        <div className="space-y-4">
          <div className="premium-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[var(--school-accent)]" />
                  Canaux de vente & publicité
                </h2>
                <p className="text-sm text-gray-400 mt-1">Connectez vos plateformes pour automatiser la diffusion et le suivi.</p>
              </div>
              <Link
                to="/studio/ad-creator"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--school-accent)] text-black text-sm font-semibold hover:bg-amber-500 transition-all"
              >
                <Megaphone className="w-4 h-4" />
                Ouvrir Ad Creator Studio
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Meta (Facebook + Instagram)', icon: Facebook, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', status: 'disconnected', desc: 'Pixel + Conversions API' },
                { label: 'TikTok Ads', icon: Film, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', status: 'disconnected', desc: 'TikTok for Business' },
                { label: 'YouTube Ads', icon: Youtube, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', status: 'disconnected', desc: 'Google Ads / YouTube' },
                { label: 'Google Analytics 4', icon: BarChart3, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', status: 'disconnected', desc: 'Suivi conversions + GA4' },
              ].map((c) => (
                <div key={c.label} className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
                  <c.icon className={`w-6 h-6 mb-3 ${c.color}`} />
                  <p className="text-sm font-semibold text-white">{c.label}</p>
                  <p className="text-xs text-gray-400 mt-1 mb-3">{c.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Non connecté</span>
                    <Link to="/studio/ad-creator?tab=channels" className={`text-[10px] ${c.color} hover:underline`}>Configurer →</Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] p-4">
              <p className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[var(--school-accent)]" />
                Studio de création publicitaire
              </p>
              <p className="text-xs text-gray-300 mb-3">
                Créez des publicités IA depuis vos modules de cours, clips de sessions live, et publiez directement sur vos canaux connectés.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-400">
                {['Sélectionner un extrait de cours ou live', 'Générer titre + description + CTA avec l\'IA', 'Publier sur Facebook, TikTok, YouTube'].map((step, i) => (
                  <div key={step} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'orchestration' && (
        <div className="premium-panel p-5 space-y-3">
          <h2 className="text-white font-semibold">Growth Orchestration Engine</h2>
          <p className="text-sm text-gray-400">
            Pilotage scenario global: visitor - funnel - relance - booking - payment recovery - onboarding.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
              onClick={async () => {
                setScoreRefreshLoading(true);
                try {
                  const tenantCtx = await fetchTenantContext().catch(() => null);
                  const tenantSlug = tenantCtx?.slug ? String(tenantCtx.slug).trim().toLowerCase() : '';
                  const scoreUrl = tenantSlug
                    ? `/api/marketing/score/refresh?tenant_slug=${encodeURIComponent(tenantSlug)}`
                    : '/api/marketing/score/refresh';
                  const payload = await authFetch(scoreUrl, { method: 'POST' });
                  toast({
                    title: 'Score refresh termine',
                    description: `${payload.updated || 0}/${payload.total || 0} leads mises a jour.`,
                  });
                } catch (e) {
                  toast({ title: 'Score refresh error', description: String(e?.message || e), variant: 'destructive' });
                } finally {
                  setScoreRefreshLoading(false);
                }
              }}
              disabled={scoreRefreshLoading}
            >
              {scoreRefreshLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Recalculer scores intelligents
            </Button>
            <Button
              className="bg-[var(--school-accent)] text-black hover:bg-amber-500"
              onClick={async () => {
                setOrchestrateLoading(true);
                setOrchestrateResult(null);
                try {
                  const tenantCtx = await fetchTenantContext().catch(() => null);
                  const tenantSlug = tenantCtx?.slug ? String(tenantCtx.slug).trim().toLowerCase() : '';
                  const payload = await authFetch('/api/marketing/orchestrate', {
                    method: 'POST',
                    body: JSON.stringify(tenantSlug ? { tenant_slug: tenantSlug } : {}),
                  });
                  setOrchestrateResult(payload);
                  toast({ title: 'Orchestration executee', description: 'Scenario auto lance avec succes.' });
                } catch (e) {
                  toast({ title: 'Orchestration error', description: String(e?.message || e), variant: 'destructive' });
                } finally {
                  setOrchestrateLoading(false);
                }
              }}
              disabled={orchestrateLoading}
            >
              {orchestrateLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Lancer orchestration globale
            </Button>
          </div>
          {orchestrateResult ? (
            <div className="rounded-lg border border-white/10 bg-[#0F1419]/70 p-4">
              <p className="text-sm text-white">Lead cible: {orchestrateResult.leadId}</p>
              <div className="mt-2 space-y-1">
                {(orchestrateResult.executed || []).map((step, idx) => (
                  <p key={`step-${idx}`} className="text-xs text-gray-300">
                    {step.step}: {step.result}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
