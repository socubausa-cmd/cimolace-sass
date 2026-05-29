import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  ClipboardCopy,
  Copy,
  GitCompare,
  History,
  Loader2,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import {
  assertWorkspacePayload,
  compareWorkspacePayloadsForUi,
} from '../lib/courseWorkspaceBundle';
import { buildWorkspacePayloadFromStores } from '../store/smartboardWorkspaceApi';
import {
  labelLifecycleStatusFr,
  LIRI_WORKSPACE_LIFECYCLE_STATUSES,
  normalizeLifecycleStatus,
} from '../lib/liriWorkspaceLifecycle';
import {
  fetchLiriCourseWorkspaceList,
  saveLiriCourseWorkspace,
  fetchLiriCourseWorkspaceById,
  deleteLiriCourseWorkspace,
  fetchWorkspaceSharesEnriched,
  upsertWorkspaceShare,
  removeWorkspaceShare,
  insertWorkspaceVersion,
  fetchWorkspaceVersions,
  fetchWorkspaceVersionPayload,
  deleteWorkspaceVersion,
  createWorkspaceInvite,
} from '../lib/liriCourseWorkspaceSupabase';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';

function inferDefaultTitle() {
  const copilot = useCourseCopilotStore.getState();
  if (copilot.course?.title) return copilot.course.title.slice(0, 80);
  const line = copilot.sourceText?.split('\n').map((l) => l.trim()).find(Boolean);
  if (line) return line.slice(0, 80);
  return `Workspace ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`;
}

const CLOUD_AUTOSAVE_KEY = 'liri_course_workspace_cloud_autosave';
const VERSION_ON_SAVE_KEY = 'liri_course_workspace_version_on_save';

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test((s || '').trim());
}

/**
 * @param {{
 *   onWorkspaceLoaded: (payload: ReturnType<typeof assertWorkspacePayload>) => void;
 *   cloudBootstrap?: { workspaceId: string; title?: string; accessRole: 'viewer' | 'editor' } | null;
 *   onCloudBootstrapConsumed?: () => void;
 *   inviteStudioPath?: string;
 * }} props
 */
export default function CourseWorkspaceCloudSection({
  onWorkspaceLoaded,
  cloudBootstrap = null,
  onCloudBootstrapConsumed,
  inviteStudioPath = '/studio/smartboard-designer',
}) {
  const [user, setUser] = useState(null);
  const [list, setList] = useState([]);
  const [listFilter, setListFilter] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [cloudId, setCloudId] = useState(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [accessRole, setAccessRole] = useState(
    /** @type {'owner' | 'viewer' | 'editor' | null} */ (null),
  );
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState(null);
  const [shareRows, setShareRows] = useState([]);
  const [granteeDraft, setGranteeDraft] = useState('');
  const [shareRolePick, setShareRolePick] = useState(/** @type {'viewer'|'editor'} */ ('viewer'));
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [autoCloudSave, setAutoCloudSave] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(CLOUD_AUTOSAVE_KEY) === '1',
  );
  const [lastAutoAt, setLastAutoAt] = useState(null);
  const [versionOnSave, setVersionOnSave] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(VERSION_ON_SAVE_KEY) === '1',
  );
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLinkHint, setInviteLinkHint] = useState('');
  const [inviteRolePick, setInviteRolePick] = useState(/** @type {'viewer'|'editor'} */ ('viewer'));
  const [inviteTtlDays, setInviteTtlDays] = useState(14);
  const [lifecycleStatus, setLifecycleStatus] = useState(() =>
    normalizeLifecycleStatus('draft'),
  );
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');
  const [compareResult, setCompareResult] = useState(/** @type {{ identical: boolean; lines: string[] } | null} */ (null));
  const [compareBusy, setCompareBusy] = useState(false);

  const cloudIdRef = useRef(cloudId);
  const titleDraftRef = useRef(titleDraft);
  const accessRoleRef = useRef(accessRole);
  const lifecycleStatusRef = useRef(lifecycleStatus);
  useEffect(() => {
    cloudIdRef.current = cloudId;
  }, [cloudId]);
  useEffect(() => {
    titleDraftRef.current = titleDraft;
  }, [titleDraft]);
  useEffect(() => {
    accessRoleRef.current = accessRole;
  }, [accessRole]);
  useEffect(() => {
    lifecycleStatusRef.current = lifecycleStatus;
  }, [lifecycleStatus]);

  useEffect(() => {
    try {
      localStorage.setItem(CLOUD_AUTOSAVE_KEY, autoCloudSave ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [autoCloudSave]);

  useEffect(() => {
    try {
      localStorage.setItem(VERSION_ON_SAVE_KEY, versionOnSave ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [versionOnSave]);

  const canEditCloud =
    !cloudId || accessRole === 'owner' || accessRole === 'editor';
  const canManageShares = accessRole === 'owner' && Boolean(cloudId);
  const canDeleteWorkspace = accessRole === 'owner' && Boolean(cloudId);

  const filteredWorkspaceList = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => (r.title || '').toLowerCase().includes(q));
  }, [list, listFilter]);

  const refreshList = useCallback(async () => {
    setListLoading(true);
    setStatus('');
    try {
      const { rows, error } = await fetchLiriCourseWorkspaceList();
      if (error) {
        setList([]);
        setStatus(error.message);
        return;
      }
      setList(rows);
    } finally {
      setListLoading(false);
    }
  }, []);

  const refreshShares = useCallback(async () => {
    if (!cloudId || !canManageShares) {
      setShareRows([]);
      return;
    }
    const { rows, error } = await fetchWorkspaceSharesEnriched(cloudId);
    if (error) {
      setStatus(error.message);
      setShareRows([]);
      return;
    }
    setShareRows(rows);
  }, [cloudId, canManageShares]);

  useEffect(() => {
    void refreshShares();
  }, [refreshShares]);

  useEffect(() => {
    if (!cloudBootstrap?.workspaceId) return;
    setCloudId(cloudBootstrap.workspaceId);
    if (cloudBootstrap.title != null && cloudBootstrap.title !== '') {
      setTitleDraft(cloudBootstrap.title);
    }
    setAccessRole(cloudBootstrap.accessRole === 'editor' ? 'editor' : 'viewer');
    setWorkspaceOwnerId(null);
    onCloudBootstrapConsumed?.();
  }, [cloudBootstrap, onCloudBootstrapConsumed]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
      if (session) void refreshList();
      else {
        setList([]);
        setCloudId(null);
        setAccessRole(null);
        setWorkspaceOwnerId(null);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session) void refreshList();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshList]);

  const buildPayloadNow = useCallback(() => buildWorkspacePayloadFromStores(), []);

  const loadVersions = useCallback(async () => {
    if (!cloudId) return;
    setVersionsLoading(true);
    try {
      const { rows, error } = await fetchWorkspaceVersions(cloudId, 30);
      if (error) {
        setStatus(error.message);
        setVersions([]);
        return;
      }
      setVersions(rows);
    } finally {
      setVersionsLoading(false);
    }
  }, [cloudId]);

  const handleSaveCloud = async () => {
    if (!canEditCloud) return;
    setBusy(true);
    setStatus('');
    const wasNew = !cloudId;
    try {
      const payload = buildPayloadNow();
      const title = titleDraft.trim() || inferDefaultTitle();
      const { id, error } = await saveLiriCourseWorkspace({
        id: cloudId,
        title,
        payload,
        lifecycleStatus: lifecycleStatusRef.current,
      });
      if (error) {
        setStatus(error.message);
        return;
      }
      if (id) setCloudId(id);
      setTitleDraft(title);
      if (wasNew) {
        setAccessRole('owner');
        setWorkspaceOwnerId(user?.id ?? null);
      }
      setStatus('Enregistré sur le cloud.');
      await refreshList();
      const savedId = id ?? cloudId;
      if (versionOnSave && !wasNew && savedId) {
        const { error: verErr } = await insertWorkspaceVersion(savedId, payload, title);
        if (verErr) {
          setStatus(`Enregistré — historique : ${verErr.message}`);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAsCopy = async () => {
    setBusy(true);
    setStatus('');
    try {
      const payload = buildPayloadNow();
      const base = titleDraft.trim() || inferDefaultTitle();
      const title = `Copie · ${base}`.slice(0, 200);
      const { id, error } = await saveLiriCourseWorkspace({
        id: null,
        title,
        payload,
        lifecycleStatus: 'draft',
      });
      if (error) {
        setStatus(error.message);
        return;
      }
      if (id) setCloudId(id);
      setTitleDraft(title);
      setLifecycleStatus('draft');
      setAccessRole('owner');
      setWorkspaceOwnerId(user?.id ?? null);
      setStatus('Nouvelle fiche cloud (copie du contenu actuel).');
      await refreshList();
    } finally {
      setBusy(false);
    }
  };

  const handleSnapshotVersion = async () => {
    if (!cloudId || !canEditCloud) return;
    setBusy(true);
    setStatus('');
    try {
      const payload = buildPayloadNow();
      const title = titleDraft.trim() || inferDefaultTitle();
      const { error } = await insertWorkspaceVersion(cloudId, payload, title);
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus('Version mémorisée.');
      await loadVersions();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteVersion = async (versionId) => {
    if (!versionId || !canDeleteWorkspace) return;
    if (!window.confirm('Supprimer cette entrée d\'historique ?')) return;
    setBusy(true);
    setStatus('');
    try {
      const { error } = await deleteWorkspaceVersion(versionId);
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus('Version supprimée.');
      await loadVersions();
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreVersion = async (versionId) => {
    if (!versionId) return;
    setBusy(true);
    setStatus('');
    try {
      const { row, error } = await fetchWorkspaceVersionPayload(versionId);
      if (error || !row?.payload) {
        setStatus(error?.message || 'Version introuvable');
        return;
      }
      const payload = assertWorkspacePayload(row.payload);
      onWorkspaceLoaded(payload);
      setStatus(`Version du ${new Date(row.created_at).toLocaleString('fr-FR')} restaurée localement — enregistrez pour pousser sur le cloud.`);
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicateVersionAsNewWorkspace = async (versionId) => {
    if (!versionId) return;
    setBusy(true);
    setStatus('');
    try {
      const { row, error } = await fetchWorkspaceVersionPayload(versionId);
      if (error || !row?.payload) {
        setStatus(error?.message || 'Version introuvable');
        return;
      }
      const payload = assertWorkspacePayload(row.payload);
      const base = (row.title_snapshot || inferDefaultTitle()).slice(0, 120);
      const title = `Branche · ${base}`.slice(0, 200);
      const { id, error: saveErr } = await saveLiriCourseWorkspace({
        id: null,
        title,
        payload,
        lifecycleStatus: 'draft',
      });
      if (saveErr || !id) {
        setStatus(saveErr?.message || 'Échec de la création de fiche');
        return;
      }
      setCloudId(id);
      setTitleDraft(title);
      setLifecycleStatus('draft');
      setAccessRole('owner');
      setWorkspaceOwnerId(user?.id ?? null);
      onWorkspaceLoaded(payload);
      setStatus('Nouvelle fiche cloud créée à partir de cette version.');
      await refreshList();
    } finally {
      setBusy(false);
    }
  };

  const handleRunVersionCompare = async () => {
    if (!compareLeftId || !compareRightId) {
      setStatus('Sélectionnez deux versions à comparer.');
      return;
    }
    if (compareLeftId === compareRightId) {
      setStatus('Choisissez deux versions distinctes.');
      return;
    }
    setCompareBusy(true);
    setCompareResult(null);
    setStatus('');
    try {
      const [a, b] = await Promise.all([
        fetchWorkspaceVersionPayload(compareLeftId),
        fetchWorkspaceVersionPayload(compareRightId),
      ]);
      if (a.error || !a.row?.payload) {
        setStatus(a.error?.message || 'Version A introuvable');
        return;
      }
      if (b.error || !b.row?.payload) {
        setStatus(b.error?.message || 'Version B introuvable');
        return;
      }
      const left = assertWorkspacePayload(a.row.payload);
      const right = assertWorkspacePayload(b.row.payload);
      setCompareResult(compareWorkspacePayloadsForUi(left, right));
    } catch (e) {
      setStatus(e?.message ? String(e.message) : 'Comparaison impossible');
    } finally {
      setCompareBusy(false);
    }
  };

  useEffect(() => {
    if (!user || !cloudId || !autoCloudSave || !canEditCloud) return undefined;
    const intervalMs = 120_000;
    const id = window.setInterval(async () => {
      const cid = cloudIdRef.current;
      const role = accessRoleRef.current;
      if (!cid || (role !== 'owner' && role !== 'editor')) return;
      const payload = buildPayloadNow();
      const title = (titleDraftRef.current.trim() || inferDefaultTitle()).slice(0, 200);
      const { error } = await saveLiriCourseWorkspace({
        id: cid,
        title,
        payload,
        lifecycleStatus: lifecycleStatusRef.current,
      });
      if (error) {
        setStatus(`Autosauvegarde : ${error.message}`);
        return;
      }
      setLastAutoAt(Date.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [user, cloudId, autoCloudSave, canEditCloud, buildPayloadNow]);

  const handleLoadSelected = async (id) => {
    if (!id) return;
    setBusy(true);
    setStatus('');
    try {
      const meta = list.find((r) => r.id === id);
      const { row, error } = await fetchLiriCourseWorkspaceById(id);
      if (error || !row) {
        setStatus(error?.message || 'Introuvable');
        return;
      }
      const payload = assertWorkspacePayload(row.payload);
      setCloudId(row.id);
      setTitleDraft(row.title || '');
      setLifecycleStatus(normalizeLifecycleStatus(row.lifecycle_status));
      setWorkspaceOwnerId(row.user_id);
      if (meta?.accessRole) {
        setAccessRole(meta.accessRole);
      } else if (user && row.user_id === user.id) {
        setAccessRole('owner');
      } else {
        setAccessRole('viewer');
      }
      onWorkspaceLoaded(payload);
      setStatus('Workspace chargé.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCloud = async (id) => {
    if (!id || !canDeleteWorkspace || !window.confirm('Supprimer ce brouillon cloud ?')) return;
    setBusy(true);
    setStatus('');
    try {
      const { error } = await deleteLiriCourseWorkspace(id);
      if (error) {
        setStatus(error.message);
        return;
      }
      if (cloudId === id) {
        setCloudId(null);
        setTitleDraft('');
        setAccessRole(null);
        setWorkspaceOwnerId(null);
      }
      await refreshList();
      setStatus('Supprimé.');
    } finally {
      setBusy(false);
    }
  };

  const startNewCloud = () => {
    setCloudId(null);
    setTitleDraft(inferDefaultTitle());
    setLifecycleStatus('draft');
    setAccessRole(null);
    setWorkspaceOwnerId(null);
    setShareRows([]);
    setVersions([]);
    setStatus('Prochain enregistrement créera une nouvelle fiche cloud.');
  };

  const handleAddShare = async () => {
    if (!cloudId || !canManageShares) return;
    const gid = granteeDraft.trim();
    if (!isUuid(gid)) {
      setStatus('UUID utilisateur invalide (format attendu : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).');
      return;
    }
    if (user && gid === user.id) {
      setStatus('Vous ne pouvez pas partager avec vous-même.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const { error } = await upsertWorkspaceShare(cloudId, gid, shareRolePick);
      if (error) {
        setStatus(error.message);
        return;
      }
      setGranteeDraft('');
      setStatus('Partage enregistré.');
      await refreshShares();
    } finally {
      setBusy(false);
    }
  };

  const buildInviteUrl = (token) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const path = inviteStudioPath.startsWith('/') ? inviteStudioPath : `/${inviteStudioPath}`;
    return `${origin}${path}?cw_invite=${encodeURIComponent(token)}`;
  };

  const handleCreateInviteLink = async () => {
    if (!cloudId || !canManageShares) return;
    setInviteBusy(true);
    setInviteLinkHint('');
    try {
      const { row, error } = await createWorkspaceInvite(cloudId, inviteRolePick, inviteTtlDays);
      if (error || !row?.token) {
        setInviteLinkHint(error?.message || 'Impossible de créer le lien.');
        return;
      }
      const url = buildInviteUrl(row.token);
      await navigator.clipboard?.writeText(url);
      setInviteLinkHint('Lien copié dans le presse-papiers (usage unique, valide jusqu\'à expiration).');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRemoveShare = async (granteeId) => {
    if (!cloudId || !granteeId) return;
    setBusy(true);
    setStatus('');
    try {
      const { error } = await removeWorkspaceShare(cloudId, granteeId);
      if (error) {
        setStatus(error.message);
        return;
      }
      setStatus('Accès retiré.');
      await refreshShares();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-cyan-500/20 bg-cyan-950/15 p-2">
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-200/90">
        {user ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3 text-white/40" />}
        Cloud Supabase
      </div>
      <p className="text-[8px] leading-relaxed text-cyan-100/60">
        Sauvegarde du design : projet Konva + plan Copilot (workspace JSON).
      </p>
      {!user ? (
        <p className="text-[9px] leading-relaxed text-white/45">
          Connectez-vous à l'app pour sauvegarder et rouvrir vos workspaces sur un autre appareil.
        </p>
      ) : (
        <>
          <p className="text-[8px] text-white/40">
            Cloud : migrations 202604302290 → 295 (statuts cycle de vie + versions max. 30).
          </p>
          {accessRole ? (
            <p className="rounded border border-white/10 bg-black/30 px-2 py-1 text-[9px] text-white/60">
              Accès :{' '}
              <span className="text-cyan-200">
                {accessRole === 'owner'
                  ? 'Propriétaire'
                  : accessRole === 'editor'
                    ? 'Co-édition'
                    : 'Lecture seule'}
              </span>
              {workspaceOwnerId && workspaceOwnerId !== user?.id ? (
                <span className="ml-1 text-white/35"> · propriétaire {workspaceOwnerId.slice(0, 8)}…</span>
              ) : null}
            </p>
          ) : null}
          <label className="block text-[8px] text-white/45">
            Titre
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              disabled={!canEditCloud && !!cloudId}
              placeholder={inferDefaultTitle()}
              className="mt-0.5 w-full rounded border border-white/12 bg-black/40 px-1.5 py-1 text-[10px] text-white disabled:opacity-50"
            />
          </label>
          {canEditCloud || !cloudId ? (
            <label className="block text-[8px] text-white/45">
              Statut (parcours)
              <select
                value={lifecycleStatus}
                onChange={(e) =>
                  setLifecycleStatus(normalizeLifecycleStatus(e.target.value))
                }
                className="mt-0.5 w-full rounded border border-white/12 bg-black/40 py-1 text-[10px] text-white"
              >
                {LIRI_WORKSPACE_LIFECYCLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {labelLifecycleStatusFr(s)}
                  </option>
                ))}
              </select>
            </label>
          ) : cloudId ? (
            <p className="rounded border border-white/8 bg-black/25 px-2 py-1 text-[9px] text-white/50">
              Statut :{' '}
              <span className="text-cyan-200/90">{labelLifecycleStatusFr(lifecycleStatus)}</span>
            </p>
          ) : null}
          {canEditCloud || !cloudId ? (
            <div className="space-y-1.5">
              <label className="flex cursor-pointer items-center gap-2 text-[9px] text-white/55">
                <input
                  type="checkbox"
                  checked={autoCloudSave}
                  onChange={(e) => setAutoCloudSave(e.target.checked)}
                  className="rounded border-white/20 bg-black/40"
                />
                Autosauvegarde cloud (~2 min) si une fiche est active
              </label>
              {cloudId ? (
                <label className="flex cursor-pointer items-center gap-2 text-[9px] text-white/55">
                  <input
                    type="checkbox"
                    checked={versionOnSave}
                    onChange={(e) => setVersionOnSave(e.target.checked)}
                    className="rounded border-white/20 bg-black/40"
                  />
                  Créer une version à chaque enregistrement (pas à la création)
                </label>
              ) : null}
            </div>
          ) : null}
          {lastAutoAt ? (
            <p className="text-[8px] text-white/35">
              Dernière synchro auto :{' '}
              {new Date(lastAutoAt).toLocaleTimeString('fr-FR', { timeStyle: 'short' })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={busy || (cloudId && !canEditCloud)}
              onClick={() => void handleSaveCloud()}
              className="flex-1 rounded-lg border border-cyan-500/35 bg-cyan-600/20 py-1.5 text-[10px] text-cyan-100 hover:bg-cyan-600/30 disabled:opacity-50"
            >
              {busy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : cloudId ? 'Mettre à jour' : 'Créer sur le cloud'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSaveAsCopy()}
              title="Enregistrer une copie (nouvelle fiche cloud)"
              aria-label="Enregistrer une copie sur le cloud"
              className="rounded-lg border border-white/12 px-2 py-1.5 text-[9px] text-white/70 hover:bg-white/5"
            >
              <Copy className="mx-auto h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={startNewCloud}
              className="rounded-lg border border-white/12 px-2 py-1.5 text-[9px] text-white/55 hover:bg-white/5"
            >
              Nouveau
            </button>
            <button
              type="button"
              disabled={listLoading}
              onClick={() => void refreshList()}
              title="Rafraîchir la liste"
              className="rounded-lg border border-white/12 p-1.5 text-white/50 hover:bg-white/5"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', listLoading && 'animate-spin')} />
            </button>
          </div>
          <div>
            <p className="mb-1 text-[8px] uppercase text-white/35">Ouvrir</p>
            <input
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              placeholder="Filtrer par titre…"
              className="mb-1 w-full rounded border border-white/10 bg-black/40 px-1.5 py-1 text-[10px] text-white placeholder:text-white/25"
            />
            {listFilter.trim() && filteredWorkspaceList.length !== list.length ? (
              <p className="mb-1 text-[8px] text-white/35">
                {filteredWorkspaceList.length} sur {list.length} fiche(s)
              </p>
            ) : null}
            <select
              disabled={busy || filteredWorkspaceList.length === 0}
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) void handleLoadSelected(v);
                e.target.value = '';
              }}
              className="w-full rounded border border-white/12 bg-black/50 py-1.5 pl-1 text-[10px] text-white"
            >
              <option value="">
                {list.length === 0 ? '— Aucun brouillon —' : '— Choisir un brouillon —'}
              </option>
              {filteredWorkspaceList.map((r) => (
                <option key={r.id} value={r.id}>
                  {(r.title || 'Sans titre').slice(0, 36)}
                  {' · '}
                  {labelLifecycleStatusFr(normalizeLifecycleStatus(r.lifecycle_status))}
                  {r.accessRole === 'owner' ? '' : r.accessRole === 'editor' ? ' · édition' : ' · lecture'} ·{' '}
                  {new Date(r.updated_at).toLocaleString('fr-FR', { dateStyle: 'short' })}
                </option>
              ))}
            </select>
          </div>

          {cloudId ? (
            <details
              className="rounded-lg border border-white/10 bg-black/20"
              onToggle={(e) => {
                if (/** @type {HTMLDetailsElement} */ (e.target).open) void loadVersions();
              }}
            >
              <summary className="cursor-pointer select-none px-2 py-1.5 text-[9px] font-medium text-white/65">
                <span className="inline-flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Historique (30 dernières — rétention serveur identique)
                </span>
              </summary>
              <div className="space-y-2 border-t border-white/8 p-2">
                {canEditCloud ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSnapshotVersion()}
                    className="w-full rounded-lg border border-violet-500/30 bg-violet-950/30 py-1.5 text-[9px] text-violet-100 hover:bg-violet-950/50"
                  >
                    Mémoriser une version maintenant
                  </button>
                ) : (
                  <p className="text-[8px] text-white/35">Lecture seule — vous pouvez restaurer ou dupliquer une version.</p>
                )}
                <button
                  type="button"
                  disabled={versionsLoading}
                  onClick={() => void loadVersions()}
                  className="w-full text-[8px] text-white/40 underline-offset-2 hover:text-white/60 hover:underline"
                >
                  Rafraîchir la liste
                </button>
                {versionsLoading ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-white/40" />
                ) : (
                  <ul className="max-h-48 space-y-1 overflow-y-auto [scrollbar-width:thin]">
                    {versions.length === 0 ? (
                      <li className="text-[8px] text-white/35">Aucune version mémorisée.</li>
                    ) : (
                      versions.map((v) => (
                        <li
                          key={v.id}
                          className="flex items-center justify-between gap-1 rounded border border-white/8 bg-black/30 px-1.5 py-1 text-[8px]"
                        >
                          <span className="min-w-0 truncate text-white/55">
                            {(v.title_snapshot || 'Sans titre').slice(0, 28)} ·{' '}
                            {new Date(v.created_at).toLocaleString('fr-FR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                          <span className="flex shrink-0 gap-0.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleRestoreVersion(v.id)}
                              className="rounded border border-cyan-500/25 px-1.5 py-0.5 text-[8px] text-cyan-200 hover:bg-cyan-500/10"
                            >
                              Restaurer
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              title="Dupliquer en nouvelle fiche cloud (propriétaire = vous)"
                              onClick={() => void handleDuplicateVersionAsNewWorkspace(v.id)}
                              className="rounded border border-amber-500/25 px-1 py-0.5 text-[8px] text-amber-200/95 hover:bg-amber-500/10"
                            >
                              Branche
                            </button>
                            {canDeleteWorkspace ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleDeleteVersion(v.id)}
                                className="rounded border border-red-500/20 px-1 py-0.5 text-[8px] text-red-300/90 hover:bg-red-500/10"
                                title="Supprimer cette version"
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </details>
          ) : null}

          {cloudId ? (
            <details
              className="rounded-lg border border-white/10 bg-black/20"
              onToggle={(e) => {
                if (/** @type {HTMLDetailsElement} */ (e.target).open) void loadVersions();
              }}
            >
              <summary className="cursor-pointer select-none px-2 py-1.5 text-[9px] font-medium text-white/65">
                <span className="inline-flex items-center gap-1">
                  <GitCompare className="h-3 w-3" />
                  Comparer deux versions
                </span>
              </summary>
              <div className="space-y-2 border-t border-white/8 p-2">
                <p className="text-[8px] leading-relaxed text-white/40">
                  Indicateurs pédagogiques et tailles (pas un diff texte intégral des JSON).
                </p>
                <div className="flex flex-col gap-1 sm:flex-row">
                  <select
                    value={compareLeftId}
                    onChange={(e) => {
                      setCompareLeftId(e.target.value);
                      setCompareResult(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-white/12 bg-black/40 py-1 text-[8px] text-white"
                  >
                    <option value="">Version A</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {(v.title_snapshot || '…').slice(0, 22)} ·{' '}
                        {new Date(v.created_at).toLocaleString('fr-FR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={compareRightId}
                    onChange={(e) => {
                      setCompareRightId(e.target.value);
                      setCompareResult(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-white/12 bg-black/40 py-1 text-[8px] text-white"
                  >
                    <option value="">Version B</option>
                    {versions.map((v) => (
                      <option key={`cmp-b-${v.id}`} value={v.id}>
                        {(v.title_snapshot || '…').slice(0, 22)} ·{' '}
                        {new Date(v.created_at).toLocaleString('fr-FR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={compareBusy || versions.length < 2}
                  onClick={() => void handleRunVersionCompare()}
                  className="w-full rounded-lg border border-amber-500/25 bg-amber-950/20 py-1.5 text-[9px] text-amber-100 hover:bg-amber-950/40 disabled:opacity-40"
                >
                  {compareBusy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Comparer'}
                </button>
                {compareResult ? (
                  <ul className="rounded border border-white/8 bg-black/35 p-2 text-[8px] leading-relaxed text-white/65">
                    {compareResult.lines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
          ) : null}

          {cloudId && canManageShares ? (
            <details className="rounded-lg border border-white/10 bg-black/20" open={false}>
              <summary className="cursor-pointer select-none px-2 py-1.5 text-[9px] font-medium text-white/65">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Partager (UUID du compte)
                </span>
              </summary>
              <div className="space-y-2 border-t border-white/8 p-2">
                <p className="text-[8px] leading-relaxed text-white/40">
                  Collez l'UUID du compte du collaborateur (même valeur que dans Supabase Auth / profil). Lecteur :
                  ouverture seule ; éditeur : enregistrement et versions.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (user?.id) void navigator.clipboard?.writeText(user.id);
                  }}
                  className="flex w-full items-center justify-center gap-1 rounded border border-white/10 py-1 text-[8px] text-white/50 hover:bg-white/5"
                >
                  <ClipboardCopy className="h-3 w-3" />
                  Copier mon ID ({user?.id ? `${user.id.slice(0, 8)}…` : '—'})
                </button>
                <input
                  value={granteeDraft}
                  onChange={(e) => setGranteeDraft(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full rounded border border-white/12 bg-black/40 px-1.5 py-1 font-mono text-[9px] text-white"
                />
                <select
                  value={shareRolePick}
                  onChange={(e) => setShareRolePick(/** @type {'viewer'|'editor'} */ (e.target.value))}
                  className="w-full rounded border border-white/12 bg-black/40 py-1 text-[10px] text-white"
                >
                  <option value="viewer">Lecture seule</option>
                  <option value="editor">Co-édition</option>
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleAddShare()}
                  className="w-full rounded-lg border border-white/15 py-1.5 text-[9px] text-white/80 hover:bg-white/5"
                >
                  Ajouter / mettre à jour l'accès
                </button>
                <ul className="space-y-1 text-[8px] text-white/50">
                  {shareRows.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-1 rounded bg-black/25 px-1 py-0.5">
                      <span className="min-w-0 truncate" title={s.grantee_id}>
                        {s.display_name || `${s.grantee_id.slice(0, 8)}…`}
                      </span>
                      <span className="shrink-0 text-cyan-200/80">{s.role}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRemoveShare(s.grantee_id)}
                        className="text-red-300/80 hover:underline"
                      >
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}

          {cloudId && canManageShares ? (
            <details className="rounded-lg border border-white/10 bg-black/20" open={false}>
              <summary className="cursor-pointer select-none px-2 py-1.5 text-[9px] font-medium text-white/65">
                <span className="inline-flex items-center gap-1">
                  <ClipboardCopy className="h-3 w-3" />
                  Lien d'invitation (sans UUID)
                </span>
              </summary>
              <div className="space-y-2 border-t border-white/8 p-2">
                <p className="text-[8px] leading-relaxed text-white/40">
                  Génère une URL à envoyer par message. Le destinataire ouvre le lien connecté : accès ajouté une fois par
                  lien (usage unique).
                </p>
                <select
                  value={inviteRolePick}
                  onChange={(e) => setInviteRolePick(/** @type {'viewer'|'editor'} */ (e.target.value))}
                  className="w-full rounded border border-white/12 bg-black/40 py-1 text-[10px] text-white"
                >
                  <option value="viewer">Lecture seule</option>
                  <option value="editor">Co-édition</option>
                </select>
                <label className="block text-[8px] text-white/45">
                  Expire dans (jours, max. 90)
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={inviteTtlDays}
                    onChange={(e) => setInviteTtlDays(Math.min(90, Math.max(1, Number(e.target.value) || 14)))}
                    className="mt-0.5 w-full rounded border border-white/12 bg-black/40 px-1.5 py-1 text-[10px] text-white"
                  />
                </label>
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={() => void handleCreateInviteLink()}
                  className="w-full rounded-lg border border-cyan-500/30 bg-cyan-950/25 py-1.5 text-[9px] text-cyan-100 hover:bg-cyan-950/45 disabled:opacity-50"
                >
                  {inviteBusy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Créer et copier le lien'}
                </button>
                {inviteLinkHint ? (
                  <p className="text-[8px] leading-snug text-cyan-200/80">{inviteLinkHint}</p>
                ) : null}
              </div>
            </details>
          ) : null}

          {cloudId && canDeleteWorkspace ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDeleteCloud(cloudId)}
              className="flex w-full items-center justify-center gap-1 rounded-lg border border-red-500/25 py-1.5 text-[9px] text-red-300/90 hover:bg-red-500/10"
            >
              <Trash2 className="h-3 w-3" />
              Supprimer la fiche cloud active
            </button>
          ) : null}
        </>
      )}
      {status ? <p className="text-[9px] text-cyan-200/80">{status}</p> : null}
    </div>
  );
}
