import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, User, Building2, Layers, Loader2, CornerDownLeft } from 'lucide-react';
import { crmApi } from '@/lib/api-v2';

/* ── Palette de recherche globale (Cmd-K) — contacts · sociétés · deals (#9).
   Charte LIRI : warm dark, accent coral. Debounce 180 ms, navigation clavier. */

function contactName(c) {
  return `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Contact';
}

export default function CrmSearchPalette({ open, onClose, onPick }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState({ contacts: [], companies: [], deals: [] });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const reqRef = useRef(0);

  // Liste plate pour la navigation clavier.
  const flat = [
    ...res.contacts.map((c) => ({ kind: 'contact', view: 'contacts', id: c.id, label: contactName(c), sub: c.email || '' })),
    ...res.companies.map((c) => ({ kind: 'company', view: 'companies', id: c.id, label: c.name || 'Sans nom', sub: c.website || '' })),
    ...res.deals.map((d) => ({ kind: 'deal', view: 'pipeline', id: d.id, label: d.title || 'Deal', sub: d.status || '' })),
  ];

  useEffect(() => {
    if (open) { setQ(''); setRes({ contacts: [], companies: [], deals: [] }); setActive(0); setTimeout(() => inputRef.current?.focus(), 20); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setRes({ contacts: [], companies: [], deals: [] }); setLoading(false); return; }
    setLoading(true);
    const rid = ++reqRef.current;
    const t = setTimeout(async () => {
      try {
        const r = await crmApi.search(term, 6);
        if (rid === reqRef.current) { setRes({ contacts: r.contacts || [], companies: r.companies || [], deals: r.deals || [] }); setActive(0); }
      } catch { /* silencieux */ }
      finally { if (rid === reqRef.current) setLoading(false); }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const pick = useCallback((item) => { if (item) { onPick?.(item); onClose(); } }, [onPick, onClose]);

  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(flat[active]); }
  };

  if (!open) return null;
  const ICON = { contact: User, company: Building2, deal: Layers };

  const Group = ({ title, items, offset }) => items.length > 0 && (
    <div className="py-1">
      <p className="px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[.08em] lp-faint">{title}</p>
      {items.map((it, i) => {
        const idx = offset + i;
        const Icon = ICON[it.kind];
        return (
          <button
            key={it.id} type="button"
            onMouseEnter={() => setActive(idx)} onClick={() => pick(it)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left lp-tr"
            style={active === idx ? { background: 'rgba(217,119,87,.13)' } : {}}
          >
            <Icon size={15} className="shrink-0 lp-coral" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] lp-ink">{it.label}</span>
              {it.sub && <span className="block truncate text-[11.5px] lp-faint">{it.sub}</span>}
            </span>
            {active === idx && <CornerDownLeft size={13} className="shrink-0 lp-faint" />}
          </button>
        );
      })}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: 'rgba(15,12,10,.55)' }} />
      <div
        role="dialog" aria-modal="true" aria-label="Recherche CRM"
        className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border lp-line shadow-2xl"
        style={{ background: '#211f1b', animation: 'crmPalIn .16s cubic-bezier(.2,.8,.2,1)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <style>{`@keyframes crmPalIn{from{transform:translateY(-8px);opacity:.5}to{transform:none;opacity:1}}`}</style>
        <div className="flex items-center gap-3 border-b lp-line px-4 py-3">
          <Search size={17} className="shrink-0 lp-muted" />
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un contact, une société, un deal…"
            className="min-w-0 flex-1 bg-transparent text-[15px] lp-ink outline-none placeholder:text-[var(--faint)]"
          />
          {loading && <Loader2 size={15} className="shrink-0 animate-spin lp-faint" />}
          <kbd className="shrink-0 rounded border lp-line px-1.5 py-0.5 text-[10px] lp-faint">esc</kbd>
        </div>
        <div className="lp-scroll max-h-[52vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="px-4 py-6 text-center text-[12.5px] lp-faint">Tapez au moins 2 caractères.</p>
          ) : flat.length === 0 && !loading ? (
            <p className="px-4 py-6 text-center text-[12.5px] lp-faint">Aucun résultat pour « {q.trim()} ».</p>
          ) : (
            <>
              <Group title="Contacts" items={res.contacts.map((c) => ({ kind: 'contact', view: 'contacts', id: c.id, label: contactName(c), sub: c.email || '' }))} offset={0} />
              <Group title="Sociétés" items={res.companies.map((c) => ({ kind: 'company', view: 'companies', id: c.id, label: c.name || 'Sans nom', sub: c.website || '' }))} offset={res.contacts.length} />
              <Group title="Deals" items={res.deals.map((d) => ({ kind: 'deal', view: 'pipeline', id: d.id, label: d.title || 'Deal', sub: d.status || '' }))} offset={res.contacts.length + res.companies.length} />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
