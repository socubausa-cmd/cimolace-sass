import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X, Building2, Users, ShoppingBag, CalendarCheck, Ticket, UserCheck,
  MessageSquare, Send, Sparkles,
} from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';

/* ── Fiche société 360° (drawer) — reliure écosystème : contacts membres + agrégats ──
   Même langage de craft que les fiches contact / deal (warm dark, coral, small-caps). */

function companyInitials(name) {
  return String(name || '')
    .split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || '').join('') || '#';
}
function StatCell({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border lp-line px-2 py-2.5" style={{ background: 'rgba(245,244,238,.03)' }}>
      <Icon size={15} className={value > 0 ? 'lp-coral' : 'lp-faint'} />
      <span className={`text-[15px] font-semibold ${value > 0 ? 'lp-ink' : 'lp-faint'}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-[.06em] lp-faint">{label}</span>
    </div>
  );
}
function SectionHead({ icon: Icon, title, count }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={14} className="lp-coral" />
      <span className="text-[11px] font-semibold uppercase tracking-[.09em] lp-muted">{title}</span>
      {count > 0 && <span className="text-[11px] font-medium lp-faint">· {count}</span>}
    </div>
  );
}

export default function CrmCompanyDetail({ company, onClose }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [platform, setPlatform] = useState(null);
  const [loading, setLoading] = useState(true);
  const reqRef = useRef(0);
  const id = company?.id;

  const load = useCallback(async () => {
    if (!id) return;
    const rid = ++reqRef.current;
    setLoading(true);
    try {
      const pf = await crmApi.getCompanyPlatform(id).catch(() => null);
      if (rid !== reqRef.current) return;
      setPlatform(pf || null);
    } catch (e) {
      if (rid === reqRef.current) toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      if (rid === reqRef.current) setLoading(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // onClose est recréé à chaque rendu parent : le garder hors des deps de `load` via une ref
  // évite un refetch + flash squelette à chaque re-render du parent (ex. auto-dismiss d'un toast).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!company) return null;

  const counts = platform?.counts || { contacts: 0, members: 0, orders: 0, appointments: 0, services: 0 };
  const members = platform?.members || [];
  const loc = [company.city, company.country].filter(Boolean).join(', ');

  const contactMember = (m) => {
    if (!m?.userId || !m?.isMember) return;
    onClose();
    navigate(`/liri/messages?to=${encodeURIComponent(m.userId)}&name=${encodeURIComponent(m.name || 'Contact')}`);
  };
  const emailMember = (m) => { if (m?.email) window.location.href = `mailto:${m.email}`; };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: 'rgba(15,12,10,.55)' }} />
      <aside
        role="dialog" aria-modal="true" aria-label={`Société ${company.name || ''}`}
        className="relative flex h-[100dvh] w-full max-w-[420px] flex-col border-l lp-line shadow-2xl"
        style={{ background: 'var(--crm-sunken, #211f1b)', animation: 'crmSlideIn .22s cubic-bezier(.2,.8,.2,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes crmSlideIn{from{transform:translateX(18px);opacity:.4}to{transform:none;opacity:1}}`}</style>

        {/* En-tête */}
        <header className="shrink-0 border-b lp-line px-5 pb-4 pt-5">
          <div className="flex items-start gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[15px] font-semibold text-white" style={{ background: 'linear-gradient(140deg,var(--crm-accent, #d97757),var(--crm-accent-strong, #c2683f))' }}>
              {companyInitials(company.name)}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="truncate text-[17px] font-semibold leading-tight lp-ink">{company.name || 'Sans nom'}</h2>
              {company.industry && <p className="truncate text-[13px] lp-muted">{company.industry}</p>}
            </div>
            <button type="button" aria-label="Fermer" onClick={onClose} className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn lp-tr">
              <X size={18} />
            </button>
          </div>
          {loc && (
            <div className="mt-3.5 flex items-center gap-2 text-[13px] lp-muted">
              <Building2 size={13.5} className="shrink-0 lp-faint" />
              <span className="truncate">{loc}</span>
            </div>
          )}
        </header>

        {/* Corps */}
        <div className="lp-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl lp-panel animate-pulse" />)}</div>
          ) : (
            <div className="space-y-7">
              {/* Écosystème agrégé */}
              <section>
                <SectionHead icon={Sparkles} title="Écosystème" count={counts.members} />
                <div className="grid grid-cols-5 gap-1.5">
                  <StatCell icon={UserCheck} label="Membres" value={counts.members} />
                  <StatCell icon={ShoppingBag} label="Cmd" value={counts.orders} />
                  <StatCell icon={CalendarCheck} label="RDV" value={counts.appointments} />
                  <StatCell icon={Ticket} label="Serv." value={counts.services} />
                  <StatCell icon={Users} label="Contacts" value={counts.contacts} />
                </div>
              </section>

              {/* Contacts de la société */}
              <section>
                <SectionHead icon={Users} title="Contacts" count={members.length} />
                {members.length === 0 ? (
                  <p className="px-1 text-[12.5px] lp-faint">Aucun contact rattaché à cette société.</p>
                ) : (
                  <div className="space-y-1.5">
                    {members.map((m) => (
                      <div key={m.contactId} className="flex items-center gap-2.5 rounded-xl border lp-line lp-panel70 px-3 py-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: m.isMember ? 'linear-gradient(140deg,var(--crm-accent, #d97757),var(--crm-accent-strong, #c2683f))' : 'rgba(245,244,238,.1)' }}>
                          {(m.name || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium lp-ink">{m.name}</span>
                            {m.isMember ? (
                              <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'color-mix(in srgb, var(--crm-accent) 15%, transparent)', color: 'var(--crm-accent-soft, #e08a63)' }}>
                                {m.role || 'Membre'}
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(245,244,238,.06)', color: 'var(--muted)' }}>
                                {m.email ? 'Prospect' : '—'}
                              </span>
                            )}
                          </div>
                          {m.email && <p className="truncate text-[11.5px] lp-faint">{m.email}</p>}
                        </div>
                        {m.isMember ? (
                          <button type="button" onClick={() => contactMember(m)} aria-label={`Contacter ${m.name}`} className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-white lp-ember lp-tr" title="Contacter (messagerie)">
                            <MessageSquare size={14} />
                          </button>
                        ) : m.email ? (
                          <button type="button" onClick={() => emailMember(m)} aria-label={`Écrire à ${m.name}`} className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border lp-line lp-muted lp-railbtn lp-tr" title="Envoyer un email">
                            <Send size={13} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
