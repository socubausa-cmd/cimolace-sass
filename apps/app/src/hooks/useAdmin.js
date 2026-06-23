import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { resolveVitrineContactEmailSync } from '@/lib/vitrineContactEmail';
import { getActiveTenantBranding } from '@/lib/tenant/activeBranding';

let auditLogsTableAvailable = true;

export const useAdmin = () => {
  const { user } = useAuth();
  return { isAdmin: user?.role === 'owner' || user?.role === 'admin', user };
};

const isMissingRelationError = (error) => {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  );
};

const isTimeoutError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('timed out');
};

const withTimeout = async (queryPromise, ms = 12000, label = 'query_timeout') => {
  let timerId;
  try {
    return await Promise.race([
      queryPromise,
      new Promise((_, reject) => {
        timerId = window.setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timerId) window.clearTimeout(timerId);
  }
};

const safeCount = async (queryPromise) => {
  try {
    const { count, error } = await withTimeout(queryPromise, 12000, 'supabase_count_timeout');
    if (error) {
      if (isMissingRelationError(error)) return { count: 0, error: null };
      return { count: 0, error };
    }
    return { count: Number(count || 0), error: null };
  } catch (error) {
    if (isTimeoutError(error)) return { count: 0, error: null };
    return { count: 0, error };
  }
};

const safeRows = async (queryPromise) => {
  try {
    const { data, error } = await withTimeout(queryPromise, 12000, 'supabase_rows_timeout');
    if (error) {
      if (isMissingRelationError(error)) return { data: [], error: null };
      return { data: [], error };
    }
    return { data: Array.isArray(data) ? data : [], error: null };
  } catch (error) {
    if (isTimeoutError(error)) return { data: [], error: null };
    return { data: [], error };
  }
};

const buildFallbackActivity = async (supabase, limit = 100) => {
  // Source: billing_invoices (not billing_payments), courses (not formations), student_progress (not enrollments)
  const [invoicesRes, webhooksRes, coursesRes, progressRes, profilesRes] = await Promise.all([
    safeRows(
      supabase
        .from('billing_invoices')
        .select('id,tenant_id,status,amount_cents,currency,provider,created_at')
        .order('created_at', { ascending: false })
        .limit(40)
    ),
    safeRows(
      supabase
        .from('billing_webhook_logs')
        .select('id,provider,event_type,processed,error_message,created_at')
        .order('created_at', { ascending: false })
        .limit(40)
    ),
    safeRows(
      supabase
        .from('courses')
        .select('id,title,status,created_at')
        .order('created_at', { ascending: false })
        .limit(30)
    ),
    safeRows(
      supabase
        .from('student_progress')
        .select('id,user_id,course_id,status,created_at')
        .order('created_at', { ascending: false })
        .limit(30)
    ),
    safeRows(
      supabase
        .from('profiles')
        .select('id,name,email,created_at')
        .order('created_at', { ascending: false })
        .limit(30)
    ),
  ]);

  const activities = [
    ...invoicesRes.data.map((row) => ({
      id: `pay-${row.id}`,
      created_at: row.created_at,
      action: String(row.status || 'pending'),
      resource_type: `billing_invoice:${row.provider || 'provider'}`,
      resource_id: row.id,
      user_id: row.tenant_id,
      changes: { amount: `${(row.amount_cents || 0)} ${row.currency || 'XAF'}` },
    })),
    ...webhooksRes.data.map((row) => ({
      id: `wh-${row.id}`,
      created_at: row.created_at,
      action: row.processed ? 'processed' : 'pending',
      resource_type: `webhook:${row.provider || 'provider'}`,
      resource_id: row.id,
      user_id: null,
      changes: { event_type: row.event_type, error: row.error_message || null },
    })),
    ...coursesRes.data.map((row) => ({
      id: `course-${row.id}`,
      created_at: row.created_at,
      action: row.status === 'published' ? 'published' : 'updated',
      resource_type: 'course',
      resource_id: row.id,
      user_id: null,
      changes: { title: row.title, status: row.status },
    })),
    ...progressRes.data.map((row) => ({
      id: `progress-${row.id}`,
      created_at: row.created_at,
      action: row.status || 'in_progress',
      resource_type: 'student_progress',
      resource_id: row.id,
      user_id: row.user_id,
      changes: { course_id: row.course_id },
    })),
    ...profilesRes.data.map((row) => ({
      id: `profile-${row.id}`,
      created_at: row.created_at,
      action: 'created',
      resource_type: 'profile',
      resource_id: row.id,
      user_id: row.id,
      changes: { email: row.email || null, name: row.name || null },
    })),
  ]
    .filter((a) => !!a.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  const userIds = [...new Set(activities.map((a) => a.user_id).filter(Boolean))];
  let profileMap = {};
  if (userIds.length > 0) {
    const { data: profileRows } = await safeRows(
      supabase.from('profiles').select('id,name,email').in('id', userIds)
    );
    profileMap = Object.fromEntries(
      (profileRows || []).map((p) => [p.id, { full_name: p.name || p.email || p.id }])
    );
  }

  return activities.map((a) => ({
    ...a,
    profiles: a.user_id ? profileMap[a.user_id] || { full_name: a.user_id } : null,
  }));
};

export const useAuditLogs = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const { supabase } = useAuth();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!auditLogsTableAvailable) {
        const fallbackLogs = await buildFallbackActivity(supabase, 100);
        setLogs(fallbackLogs);
        setLoading(false);
        return { error: null };
      }

      const { data, error: auditErr } = await supabase
        .from('audit_logs')
        .select('id,action,resource_type,resource_id,created_at,user_id,changes')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!auditErr) {
        const rows = Array.isArray(data) ? data : [];
        const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
        const { data: profileRows } =
          userIds.length > 0
            ? await safeRows(supabase.from('profiles').select('id,name,email').in('id', userIds))
            : { data: [] };
        const profileMap = Object.fromEntries(
          (profileRows || []).map((p) => [p.id, { full_name: p.name || p.email || p.id }])
        );
        setLogs(
          rows.map((r) => ({
            ...r,
            profiles: r.user_id ? profileMap[r.user_id] || { full_name: r.user_id } : null,
          }))
        );
        setLoading(false);
        return { error: null };
      }

      if (!isMissingRelationError(auditErr)) {
        throw auditErr;
      }
      auditLogsTableAvailable = false;

      const fallbackLogs = await buildFallbackActivity(supabase, 100);
      setLogs(fallbackLogs);
      setLoading(false);
      return { error: null };
    } catch (err) {
      setError(err);
      setLogs([]);
      setLoading(false);
      return { error: err };
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { logs, loading, error, refresh };
};

export const useAdminDashboard = () => {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    usersCount: 0,
    publishedFormations: 0,
    activityCount24h: 0,
    systemStatus: 'Inconnu',
    pendingWebhooks: 0,
    confirmedPayments: 0,
    revenueConfirmed: 0,
  });
  const [activities, setActivities] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auditLogsQuery = auditLogsTableAvailable
        ? safeRows(
            supabase
              .from('audit_logs')
              .select('id,action,resource_type,resource_id,created_at,user_id,changes,profiles(name,email)')
              .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
              .limit(200)
          )
        : Promise.resolve({ data: [], error: { code: 'PGRST205' } });

      const [usersCountRes, formationsCountRes, paymentsRes, webhooksRes, auditLogsRes] = await Promise.all([
        safeCount(supabase.from('profiles').select('id', { count: 'exact', head: true })),
        safeCount(
          supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'published')
        ),
        safeRows(
          supabase
            .from('billing_invoices')
            .select('id,status,amount_cents,currency,created_at')
            .order('created_at', { ascending: false })
            .limit(300)
        ),
        safeRows(
          supabase
            .from('billing_webhook_logs')
            .select('id,processed,error_message,created_at')
            .order('created_at', { ascending: false })
            .limit(300)
        ),
        auditLogsQuery,
      ]);

      if (isMissingRelationError(auditLogsRes.error)) {
        auditLogsTableAvailable = false;
      }

      const confirmedPayments = paymentsRes.data.filter((p) => ['confirmed', 'paid'].includes(String(p.status)));
      const revenueConfirmed = confirmedPayments.reduce((acc, p) => acc + Number(p.amount_cents || 0), 0);

      const pendingWebhooks = webhooksRes.data.filter((w) => !w.processed).length;
      const erroredWebhooks = webhooksRes.data.filter((w) => !!w.error_message).length;

      const activityCount24h = isMissingRelationError(auditLogsRes.error)
        ? 0
        : auditLogsRes.data.length;

      const systemStatus =
        erroredWebhooks > 0
          ? 'Alerte'
          : pendingWebhooks > 0
            ? 'À surveiller'
            : 'Actif';

      setStats({
        usersCount: usersCountRes.count,
        publishedFormations: formationsCountRes.count,
        activityCount24h,
        systemStatus,
        pendingWebhooks,
        confirmedPayments: confirmedPayments.length,
        revenueConfirmed,
      });

      const normalizedActivities = isMissingRelationError(auditLogsRes.error)
        ? []
        : (auditLogsRes.data || []).map((row) => ({
            ...row,
            profiles: row.profiles
              ? { full_name: row.profiles.name || row.profiles.email || row.user_id || 'Système' }
              : null,
          }));
      setActivities(normalizedActivities);

      setLoading(false);
      return { error: null };
    } catch (err) {
      setError(err);
      setLoading(false);
      return { error: err };
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, error, stats, activities, refresh };
};

export const useContent = (type) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const { supabase } = useAuth();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (type === 'modules') {
        const { data: plans, error: plansErr } = await supabase
          .from('billing_plans')
          .select('id,key,label,is_active,updated_at,created_at,billing_cycle,price_cents,currency')
          .order('updated_at', { ascending: false });

        if (plansErr && !isMissingRelationError(plansErr)) throw plansErr;

        const rows = (plans || []).map((row) => ({
          id: row.id,
          title: row.label || row.key || 'Sans nom',
          page_slug: null,
          module_slug: row.key,
          published: !!row.is_active,
          updated_at: row.updated_at || row.created_at || new Date().toISOString(),
          raw: row,
        }));
        setData(rows);
      } else {
        const { data: courses, error: coursesErr } = await supabase
          .from('courses')
          .select('id,title,status,meta,updated_at,created_at')
          .order('updated_at', { ascending: false });

        if (coursesErr && !isMissingRelationError(coursesErr)) throw coursesErr;

        const rows = (courses || []).map((row) => {
          const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
          return {
            id: row.id,
            title: row.title || 'Sans titre',
            page_slug: `course/${row.id}`,
            module_slug: meta.catalog_number != null ? `module-${meta.catalog_number}` : null,
            published: String(row.status || '').toLowerCase() === 'published',
            updated_at: row.updated_at || row.created_at || new Date().toISOString(),
            raw: row,
          };
        });
        setData(rows);
      }
      setLoading(false);
      return { error: null };
    } catch (err) {
      setError(err);
      setData([]);
      setLoading(false);
      return { error: err };
    }
  }, [supabase, type]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteContent = async (id) => {
    try {
      if (type === 'modules') {
        const { error: delErr } = await supabase.from('billing_plans').delete().eq('id', id);
        if (delErr) throw delErr;
      } else {
        const { error: delErr } = await supabase.from('courses').delete().eq('id', id);
        if (delErr) throw delErr;
      }
      setData((prev) => prev.filter((x) => x.id !== id));
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  };

  return { data, loading, error, refresh, deleteContent };
};

export const useSystemSettings = () => {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({
    site_name: `${getActiveTenantBranding().name} Academy`,
    contact_email: resolveVitrineContactEmailSync(),
    session_expiration_minutes: 60,
    force_2fa_admin: false,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from('app_settings')
        .select('key,value')
        .in('key', ['site_name', 'contact_email', 'session_expiration_minutes', 'force_2fa_admin']);

      if (qErr && !isMissingRelationError(qErr)) throw qErr;

      if (Array.isArray(data) && data.length > 0) {
        const merged = data.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
        setSettings((prev) => ({
          ...prev,
          ...merged,
          session_expiration_minutes: Number(merged.session_expiration_minutes ?? prev.session_expiration_minutes),
          force_2fa_admin: Boolean(merged.force_2fa_admin ?? prev.force_2fa_admin),
        }));
      }

      setLoading(false);
      return { error: null };
    } catch (err) {
      setError(err);
      setLoading(false);
      return { error: err };
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (nextSettings) => {
      try {
        const payload = Object.entries(nextSettings).map(([key, value]) => ({ key, value }));
        const { error: upsertErr } = await supabase.from('app_settings').upsert(payload, { onConflict: 'key' });
        if (upsertErr) throw upsertErr;
        setSettings((prev) => ({ ...prev, ...nextSettings }));
        return { error: null };
      } catch (err) {
        return { error: err };
      }
    },
    [supabase]
  );

  return { settings, loading, error, refresh, save, setSettings };
};

export const useUsers = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const { supabase, session } = useAuth();

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,name,role,status,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      setUsers([]);
      setLoading(false);
      return { error };
    }

    setUsers(data || []);
    setLoading(false);
    return { error: null };
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateUser = async (id, updates) => {
    const normalized = { ...updates };
    if (Object.prototype.hasOwnProperty.call(normalized, 'full_name')) {
      normalized.name = normalized.full_name;
      delete normalized.full_name;
    }

    const { error } = await supabase
      .from('profiles')
      .update(normalized)
      .eq('id', id);

    if (error) return { error };
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...normalized } : u)));
    return { error: null };
  };

  const inviteUser = async ({ email, name, role, status }) => {
    const accessToken = session?.access_token;
    if (!accessToken) return { error: new Error('Not authenticated') };

    const res = await fetch('/.netlify/functions/admin-invite-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email, name, role, status }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: new Error(payload?.error || 'Invite failed') };
    }

    await refresh();
    return { error: null, data: payload };
  };

  return { users, loading, updateUser, inviteUser, refresh };
};
