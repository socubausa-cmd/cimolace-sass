import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

export const DEFAULT_MAILBOX_ID = 'a0000000-0000-4000-8000-000000000001';

export const PIPELINE = [
  { value: 'new', label: 'Nouveau' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'to_treat', label: 'À traiter' },
  { value: 'converted', label: 'Converti' },
  { value: 'closed', label: 'Clos' },
];

export function groupByThreadId(rows) {
  const m = {};
  for (const r of rows || []) {
    if (!m[r.thread_id]) m[r.thread_id] = [];
    m[r.thread_id].push(r);
  }
  for (const k of Object.keys(m)) {
    m[k].sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
  }
  return m;
}

export function getSuggestedOffer(label) {
  const key = String(label || '').toLowerCase();
  const map = {
    urgence: 'Consultation prioritaire',
    appointment_request: 'Proposer un créneau (booking)',
    consultation: 'Consultation spirituelle',
    commercial_education: `Cursus / modules ${isnaTenantConfig.branding.name}`,
    support: 'Ticket support',
    information: 'Réponse info ou orientation cursus',
  };
  return map[key] || 'Suivi secrétariat';
}

/**
 * Logique métier Courrier infos@ (IMAP → Supabase, envoi Resend).
 */
export function useOrgMailbox() {
  const { session } = useAuth();
  const { toast } = useToast();

  const [threads, setThreads] = useState([]);
  const [emailsByThread, setEmailsByThread] = useState({});
  const [outgoingByThread, setOutgoingByThread] = useState({});
  const [mailbox, setMailbox] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [threadTagsByThread, setThreadTagsByThread] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [mailView, setMailView] = useState('inbox');
  const [replyOpen, setReplyOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ to: '', subject: '', text: '' });
  const [notesDraft, setNotesDraft] = useState('');
  const [search, setSearch] = useState('');
  const [filterPipeline, setFilterPipeline] = useState('all');

  const selected = useMemo(() => threads.find((t) => t.id === selectedId) || null, [threads, selectedId]);

  const threadTimeline = useMemo(() => {
    if (!selected) return [];
    const threadEmails = emailsByThread[selected.id] || [];
    const threadOutgoing = outgoingByThread[selected.id] || [];
    const incoming = threadEmails.map((e) => ({
      kind: 'in',
      at: e.received_at,
      data: e,
    }));
    const outgoing = threadOutgoing.map((o) => ({
      kind: 'out',
      at: o.sent_at || o.created_at,
      data: o,
    }));
    return [...incoming, ...outgoing].sort((a, b) => new Date(a.at) - new Date(b.at));
  }, [selected, emailsByThread, outgoingByThread]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: mb, error: mbErr } = await supabase
        .from('mailboxes')
        .select('*')
        .eq('id', DEFAULT_MAILBOX_ID)
        .maybeSingle();
      if (mbErr) throw mbErr;
      setMailbox(mb);

      const { data: th, error: thErr } = await supabase
        .from('email_threads')
        .select('*')
        .eq('mailbox_id', DEFAULT_MAILBOX_ID)
        .order('updated_at', { ascending: false })
        .limit(120);
      if (thErr) throw thErr;
      const list = th || [];
      setThreads(list);

      const tids = list.map((t) => t.id);
      if (tids.length) {
        const { data: em, error: emErr } = await supabase
          .from('emails')
          .select('*')
          .in('thread_id', tids)
          .order('received_at', { ascending: true });
        if (emErr) throw emErr;
        setEmailsByThread(groupByThreadId(em));

        const { data: out, error: outErr } = await supabase
          .from('outgoing_emails')
          .select('*')
          .in('thread_id', tids)
          .order('created_at', { ascending: true });
        if (outErr) throw outErr;
        setOutgoingByThread(groupByThreadId(out));

        const { data: tt } = await supabase
          .from('email_thread_tags')
          .select('thread_id, tag_id')
          .in('thread_id', tids);
        const map = {};
        for (const row of tt || []) {
          if (!map[row.thread_id]) map[row.thread_id] = [];
          map[row.thread_id].push(row.tag_id);
        }
        setThreadTagsByThread(map);
      } else {
        setEmailsByThread({});
        setOutgoingByThread({});
        setThreadTagsByThread({});
      }

      const { data: tagRows } = await supabase.from('email_tags').select('*').order('name');
      setAllTags(tagRows || []);

      const { data: logs } = await supabase
        .from('email_sync_logs')
        .select('*')
        .eq('mailbox_id', DEFAULT_MAILBOX_ID)
        .order('created_at', { ascending: false })
        .limit(20);
      setSyncLogs(logs || []);

      const { data: profs } = await supabase
        .from('profiles')
        .select('id,name,email,role')
        .in('role', ['secretariat', 'admin', 'owner'])
        .order('name');
      setStaff(profs || []);
    } catch (e) {
      toast({
        title: 'Courrier CRM',
        description: e?.message || 'Chargez la migration 202604220001_integrated_mail_inbox.sql',
        variant: 'destructive',
      });
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected) {
      setNotesDraft(selected.internal_notes || '');
    }
  }, [selected]);

  const filteredThreads = useMemo(() => {
    let t = threads;
    if (filterPipeline !== 'all') {
      t = t.filter((x) => x.pipeline_status === filterPipeline);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      t = t.filter((th) => {
        const subj = String(th.subject || '').toLowerCase();
        const contact = String(th.primary_contact_email || '').toLowerCase();
        const last = emailsByThread[th.id]?.slice(-1)[0];
        const snip = String(last?.snippet || '').toLowerCase();
        return subj.includes(q) || contact.includes(q) || snip.includes(q);
      });
    }
    return t;
  }, [threads, filterPipeline, search, emailsByThread]);

  const unreadInThread = (tid) => {
    const arr = emailsByThread[tid] || [];
    return arr.filter((e) => !e.is_outbound && !e.is_read).length;
  };

  const totalUnread = useMemo(() => {
    return threads.reduce((acc, t) => {
      const arr = emailsByThread[t.id] || [];
      return acc + arr.filter((e) => !e.is_outbound && !e.is_read).length;
    }, 0);
  }, [threads, emailsByThread]);

  const totalEmails = useMemo(
    () => Object.values(emailsByThread).reduce((sum, arr) => sum + (arr?.length || 0), 0),
    [emailsByThread]
  );

  const leadsCount = useMemo(() => threads.filter((t) => t.lead_id).length, [threads]);

  const leadPreviewThreads = useMemo(
    () =>
      threads.filter(
        (t) =>
          t.lead_id ||
          (t.confidence_score != null && Number(t.confidence_score) >= 0.55)
      ),
    [threads]
  );

  const openThread = async (th) => {
    setSelectedId(th.id);
    setMailView('inbox');
    const ids = (emailsByThread[th.id] || []).filter((e) => !e.is_read).map((e) => e.id);
    if (ids.length) {
      await supabase.from('emails').update({ is_read: true }).in('id', ids);
      setEmailsByThread((prev) => {
        const next = { ...prev };
        const row = (next[th.id] || []).map((e) =>
          ids.includes(e.id) ? { ...e, is_read: true } : e
        );
        next[th.id] = row;
        return next;
      });
    }
  };

  const toggleThreadRead = async () => {
    if (!selected) return;
    const arr = emailsByThread[selected.id] || [];
    const anyUnread = arr.some((e) => !e.is_read);
    const ids = arr.map((e) => e.id);
    if (!ids.length) return;
    const nextRead = anyUnread;
    await supabase.from('emails').update({ is_read: nextRead }).in('id', ids);
    setEmailsByThread((prev) => ({
      ...prev,
      [selected.id]: arr.map((e) => ({ ...e, is_read: nextRead })),
    }));
    toast({ title: nextRead ? 'Marqué comme lu' : 'Marqué comme non lu' });
  };

  const runImapSync = async () => {
    if (!session?.access_token) return;
    setSyncing(true);
    try {
      const res = await fetch('/.netlify/functions/mail-imap-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ maxMessages: 50, sinceDays: 60 }),
      });
      const payload = await res.json();
      if (!res.ok) {
        const detail = [payload?.error, payload?.hint].filter(Boolean).join('\n\n');
        throw new Error(detail || 'Sync échouée');
      }
      toast({
        title: 'Synchronisation',
        description: `${payload.synced ?? 0} nouveau(x) message(s)`,
      });
      await load();
    } catch (e) {
      toast({ title: 'Sync IMAP', description: e?.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const updateThread = async (patch) => {
    if (!selected) return;
    const { error } = await supabase.from('email_threads').update(patch).eq('id', selected.id);
    if (error) {
      toast({ title: 'Mise à jour', description: error.message, variant: 'destructive' });
      return;
    }
    setThreads((prev) => prev.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)));
  };

  const saveNotes = async () => {
    await updateThread({ internal_notes: notesDraft });
    toast({ title: 'Notes enregistrées' });
  };

  const createOrLinkLead = async () => {
    if (!selected) return;
    const email = String(selected.primary_contact_email || '').trim();
    if (!email) {
      toast({ title: "Pas d'email contact", variant: 'destructive' });
      return;
    }
    try {
      const { data: existing } = await supabase.from('leads').select('id').eq('email', email).maybeSingle();
      let leadId = existing?.id;
      if (!leadId) {
        const { data: ins, error } = await supabase
          .from('leads')
          .insert({
            email,
            name: selected.subject?.slice(0, 120) || null,
            source: 'crm_inbox',
            last_activity_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (error) throw error;
        leadId = ins.id;
      }
      await updateThread({ lead_id: leadId, pipeline_status: 'in_progress' });
      toast({ title: 'Lead lié', description: `Lead ${leadId}` });
    } catch (e) {
      toast({ title: 'Lead', description: e?.message, variant: 'destructive' });
    }
  };

  const markUrgent = async () => {
    if (!selected) return;
    await updateThread({ pipeline_status: 'to_treat' });
    toast({ title: 'Thread marqué prioritaire (à traiter)' });
  };

  const toggleTagOnThread = async (tagId) => {
    if (!selected) return;
    const current = threadTagsByThread[selected.id] || [];
    const has = current.includes(tagId);
    if (has) {
      await supabase
        .from('email_thread_tags')
        .delete()
        .eq('thread_id', selected.id)
        .eq('tag_id', tagId);
      setThreadTagsByThread((prev) => ({
        ...prev,
        [selected.id]: (prev[selected.id] || []).filter((id) => id !== tagId),
      }));
    } else {
      await supabase.from('email_thread_tags').insert({ thread_id: selected.id, tag_id: tagId });
      setThreadTagsByThread((prev) => ({
        ...prev,
        [selected.id]: [...(prev[selected.id] || []), tagId],
      }));
    }
  };

  const openReply = () => {
    if (!selected) return;
    const tm = emailsByThread[selected.id] || [];
    const lastIn = [...tm].reverse().find((e) => !e.is_outbound);
    const from = lastIn?.from_email || selected.primary_contact_email || '';
    setForm({
      to: from,
      subject: selected.subject?.startsWith('Re:') ? selected.subject : `Re: ${selected.subject || ''}`,
      text: '\n\n—\n',
    });
    setReplyOpen(true);
  };

  const openNewCompose = () => {
    setForm({ to: '', subject: '', text: '' });
    setReplyOpen(false);
    setMailView('compose');
  };

  const sendMail = async (e) => {
    e?.preventDefault?.();
    if (!session?.access_token) return;
    if (!form.to.trim() || !form.subject.trim() || !form.text.trim()) {
      toast({ title: 'Champs requis', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/.netlify/functions/org-mailbox-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: form.to.trim(),
          subject: form.subject.trim(),
          text: form.text,
          thread_id: selected?.id || undefined,
          html: `<div style="font-family:system-ui,sans-serif;white-space:pre-wrap">${form.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</div>`,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Envoi impossible');
      toast({ title: 'Message envoyé', description: 'Expéditeur Resend (infos@)' });
      setReplyOpen(false);
      setMailView('inbox');
      await load();
    } catch (err) {
      toast({ title: 'Erreur', description: err?.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const contactInitials = (thread) => {
    const n = thread?.primary_contact_email || thread?.subject || '?';
    const parts = String(n).split(/[@\s]+/);
    const a = (parts[0] || '?')[0] || '?';
    const b = (parts[1] || '')[0] || '';
    return (a + b).toUpperCase().slice(0, 2);
  };

  return {
    session,
    threads,
    emailsByThread,
    mailbox,
    syncLogs,
    staff,
    allTags,
    threadTagsByThread,
    loading,
    syncing,
    selectedId,
    setSelectedId,
    selected,
    mailView,
    setMailView,
    replyOpen,
    setReplyOpen,
    sending,
    form,
    setForm,
    notesDraft,
    setNotesDraft,
    search,
    setSearch,
    filterPipeline,
    setFilterPipeline,
    threadTimeline,
    filteredThreads,
    totalUnread,
    totalEmails,
    leadsCount,
    leadPreviewThreads,
    load,
    runImapSync,
    updateThread,
    saveNotes,
    createOrLinkLead,
    markUrgent,
    toggleTagOnThread,
    openThread,
    toggleThreadRead,
    openReply,
    openNewCompose,
    sendMail,
    unreadInThread,
    contactInitials,
    setThreads,
  };
}
