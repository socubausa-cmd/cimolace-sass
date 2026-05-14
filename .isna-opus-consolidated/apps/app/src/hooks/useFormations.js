import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const mapCycleToYear = (cycle) => {
  const c = String(cycle || '').toLowerCase();
  if (c === 'fondements') return '1ère année';
  if (c === 'approfondissement') return '2ème année';
  if (c === 'maitrise' || c === 'maîtrise') return '3ème année';
  return '';
};

const mapYearToCycle = (year) => {
  const y = String(year || '').toLowerCase();
  if (y.startsWith('1')) return 'fondements';
  if (y.startsWith('2')) return 'approfondissement';
  if (y.startsWith('3')) return 'maitrise';
  return null;
};

const normalizeFormationForUI = (row) => {
  if (!row) return null;
  const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
  const accessMode = meta.access_mode || meta?.access?.mode || 'free';
  const billingPlanSlug = meta.billing_plan_slug || meta?.access?.billing_plan_slug || null;
  const standalonePriceRaw =
    meta.standalone_price ?? meta?.access?.standalone_price ?? row.price ?? null;
  const standalonePrice =
    standalonePriceRaw != null && standalonePriceRaw !== '' ? Number(standalonePriceRaw) : null;
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    status: row.status || 'draft',
    cycle: row.cycle || null,
    year: mapCycleToYear(row.cycle) || row.year || '',
    duration: row.duration_weeks ? `${row.duration_weeks} semaines` : row.duration || '',
    duration_weeks: row.duration_weeks ?? null,
    price: row.price ?? null,
    thumbnail: row.image_url || row.thumbnail || '',
    image_url: row.image_url || '',
    category: meta.category || row.category || '',
    level: meta.level || row.level || '',
    coverImage: meta.coverImage || '',
    access_mode: accessMode,
    billing_plan_slug: billingPlanSlug,
    standalone_price: standalonePrice,
    standalone_currency: meta.standalone_currency || meta?.access?.standalone_currency || 'XAF',
    config: meta.config || undefined,
    additionalQuizzes: Array.isArray(meta.additionalQuizzes) ? meta.additionalQuizzes : [],
    modules: Array.isArray(row.modules) ? row.modules : [],
    enrolledStudents: Array.isArray(row.enrolledStudents) ? row.enrolledStudents : [],
  };
};

const withTimeout = async (promise, ms, label) => {
  let t;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        t = window.setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (t) window.clearTimeout(t);
  }
};

const pickDbPayload = (formation) => {
  const year = formation?.year;
  const cycle = formation?.cycle || mapYearToCycle(year);
  const accessMode = formation?.access_mode || 'free';
  const standalonePrice =
    formation?.standalone_price != null && formation?.standalone_price !== ''
      ? Number(formation.standalone_price)
      : null;
  const normalizedPrice = accessMode === 'one_time' ? standalonePrice : null;
  return {
    title: formation?.title || '',
    description: formation?.description || null,
    status: formation?.status || 'draft',
    cycle: cycle || null,
    duration_weeks: Number.isFinite(Number(formation?.duration_weeks)) ? Number(formation.duration_weeks) : null,
    price: normalizedPrice,
    image_url: formation?.thumbnail || formation?.image_url || null,
    meta: {
      category: formation?.category || null,
      level: formation?.level || null,
      year: formation?.year || null,
      coverImage: formation?.coverImage || null,
      access_mode: accessMode,
      billing_plan_slug: accessMode === 'subscription' ? (formation?.billing_plan_slug || null) : null,
      standalone_price: accessMode === 'one_time' ? standalonePrice : null,
      standalone_currency: formation?.standalone_currency || 'XAF',
      config: formation?.config || null,
      additionalQuizzes: Array.isArray(formation?.additionalQuizzes) ? formation.additionalQuizzes : [],
      catalog_number: formation?.catalog_number != null ? Number(formation.catalog_number) : null,
    },
  };
};

export const useFormations = () => {
  const [formations, setFormations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshRequestIdRef = useRef(0);

  const refresh = useCallback(async (options = {}) => {
    const requestId = ++refreshRequestIdRef.current;
    const silent = !!options?.silent;
    if (!silent) setLoading(true);
    setError(null);

    const runQuery = () =>
      supabase
        .from('formations')
        .select('id, title, description, status, cycle, duration_weeks, price, image_url, meta, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

    const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));

    // Timeouts progressifs (réveil projet gratuit, réseau lent, ou soucis TLS / proxy).
    const attempts = [
      { timeoutMs: 8000, backoffMs: 0 },
      { timeoutMs: 15000, backoffMs: 1000 },
      { timeoutMs: 22000, backoffMs: 2000 },
      { timeoutMs: 45000, backoffMs: 4000 },
    ];

    let lastThrown = null;
    let result = null;

    for (let i = 0; i < attempts.length; i += 1) {
      const { timeoutMs, backoffMs } = attempts[i];
      if (backoffMs) await sleep(backoffMs);
      try {
        result = await withTimeout(runQuery(), timeoutMs, 'formations_load_timeout');
        lastThrown = null;
        break;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        lastThrown = err;
        // Only retry timeouts; any other error should surface immediately.
        if (String(err?.message || err) !== 'formations_load_timeout') break;
      }
    }

    if (!result) {
      const err = lastThrown instanceof Error ? lastThrown : new Error(String(lastThrown || 'formations_load_timeout'));
      if (refreshRequestIdRef.current !== requestId) return { data: null, error: err };
      setError(err);
      if (!silent) setFormations([]);
      setLoading(false);
      return { data: null, error: err };
    }

    const { data, error: err } = result || {};

    if (err) {
      if (refreshRequestIdRef.current !== requestId) return { data: null, error: err };
      setError(err);
      if (!silent) setFormations([]);
      setLoading(false);
      return { data: null, error: err };
    }

    const normalized = (data || []).map(normalizeFormationForUI).filter(Boolean);
    if (refreshRequestIdRef.current !== requestId) return { data: normalized, error: null };
    setFormations(normalized);
    try {
      window.localStorage.setItem('formations_cache_v1', JSON.stringify(normalized));
    } catch {
      // ignore
    }
    setLoading(false);
    return { data: normalized, error: null };
  }, []);

  useEffect(() => {
    let hadCache = false;
    try {
      const raw = window.localStorage.getItem('formations_cache_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setFormations(parsed);
          setLoading(false);
          hadCache = true;
        }
      }
    } catch {
      // ignore
    }
    refresh({ silent: hadCache });
  }, [refresh]);

  const createFormation = useCallback(async (formation) => {
    setError(null);
    const payload = pickDbPayload(formation);
    const { data, error: err } = await supabase
      .from('formations')
      .insert(payload)
      .select('id, title, description, status, cycle, duration_weeks, price, image_url, meta, created_at')
      .single();

    if (err) {
      setError(err);
      return { data: null, error: err };
    }

    const normalized = normalizeFormationForUI(data);
    setFormations((prev) => [normalized, ...prev]);
    return { data: normalized, error: null };
  }, []);

  const updateFormation = useCallback(async (id, updates) => {
    setError(null);
    const payload = pickDbPayload(updates);
    const { data, error: err } = await supabase
      .from('formations')
      .update(payload)
      .eq('id', id)
      .select('id, title, description, status, cycle, duration_weeks, price, image_url, meta, created_at')
      .single();

    if (err) {
      setError(err);
      return { data: null, error: err };
    }

    const normalized = normalizeFormationForUI(data);
    setFormations((prev) => prev.map((f) => (f.id === id ? normalized : f)));
    return { data: normalized, error: null };
  }, []);

  const deleteFormation = useCallback(async (id) => {
    setError(null);
    const { error: err } = await supabase.from('formations').delete().eq('id', id);
    if (err) {
      setError(err);
      return { error: err };
    }
    setFormations((prev) => prev.filter((f) => f.id !== id));
    return { error: null };
  }, []);

  const api = useMemo(
    () => ({ formations, loading, error, refresh, createFormation, updateFormation, deleteFormation }),
    [formations, loading, error, refresh, createFormation, updateFormation, deleteFormation]
  );

  return api;
};
