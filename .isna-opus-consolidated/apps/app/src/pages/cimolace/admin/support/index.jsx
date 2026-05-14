/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE BACK-OFFICE — Support (tickets)
 * ═══════════════════════════════════════════════════════════════
 */

import { useMemo, useState, useEffect, useCallback } from 'react';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { ticketEngine } from '@/modules/cimolace/support/ticketEngine.js';
import { TicketStatus } from '@/modules/cimolace/support/ticketTypes.js';

const CARD = {
  flex: '1',
  minWidth: '120px',
  padding: '14px 16px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
};

const STATUS_OPTIONS = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
];

export default function CimolaceAdminSupport() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    const data =
      filter === 'all' ? await ticketEngine.getAllTickets() : await ticketEngine.getAllTickets({ status: filter });
    setTickets(data);
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data =
          filter === 'all'
            ? await ticketEngine.getAllTickets()
            : await ticketEngine.getAllTickets({ status: filter });
        if (!cancelled) setTickets(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e.message || 'Chargement impossible');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => String(t.status) === TicketStatus.OPEN).length;
    const progress = tickets.filter((t) => String(t.status) === TicketStatus.IN_PROGRESS).length;
    return {
      displayed: tickets.length,
      open,
      progress,
    };
  }, [tickets]);

  async function onStatusChange(ticketId, status) {
    setBusyId(ticketId);
    try {
      setError(null);
      await ticketEngine.updateTicketStatus(ticketId, status);
      await refresh();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Mise à jour impossible');
    } finally {
      setBusyId(null);
    }
  }

  const tabBtn = (active) => ({
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    backgroundColor: active ? '#1d4ed8' : 'white',
    color: active ? 'white' : '#374151',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <CimolaceHeader />
      <div style={{ display: 'flex', flex: 1 }}>
        <CimolaceSidebar />
        <div style={{ padding: '20px', flex: 1, maxWidth: '1000px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px', color: '#111827' }}>Support</h1>

          {error ? (
            <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={CARD}>
              <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{loading ? '…' : stats.displayed}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Tickets (liste)</div>
            </div>
            <div style={CARD}>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b45309' }}>{loading ? '…' : stats.open}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Ouverts (liste)</div>
            </div>
            <div style={CARD}>
              <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{loading ? '…' : stats.progress}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>En cours (liste)</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            <button type="button" style={tabBtn(filter === 'all')} onClick={() => setFilter('all')}>Tous</button>
            <button type="button" style={tabBtn(filter === TicketStatus.OPEN)} onClick={() => setFilter(TicketStatus.OPEN)}>Ouverts</button>
            <button type="button" style={tabBtn(filter === TicketStatus.IN_PROGRESS)} onClick={() => setFilter(TicketStatus.IN_PROGRESS)}>En cours</button>
            <button type="button" style={tabBtn(filter === TicketStatus.RESOLVED)} onClick={() => setFilter(TicketStatus.RESOLVED)}>Résolus</button>
          </div>

          <div style={{ backgroundColor: 'white', padding: '18px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            {loading ? (
              <p style={{ color: '#6b7280' }}>Chargement…</p>
            ) : tickets.length === 0 ? (
              <p style={{ color: '#6b7280', margin: 0 }}>Aucun ticket pour ce filtre.</p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {tickets.map((ticket) => {
                  const site = ticket.cimolace_sites;
                  const tenant = site?.cimolace_tenants;
                  return (
                    <div
                      key={ticket.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1', minWidth: '200px' }}>
                          <div style={{ fontWeight: 700, color: '#111827' }}>{ticket.ticket_number}</div>
                          <div style={{ fontSize: '14px', color: '#374151', marginTop: '4px' }}>{ticket.subject}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                            {site ? `${site.name}${tenant ? ` · ${tenant.name}` : ''}` : 'Sans site'} · priorité&nbsp;{' '}
                            <strong>{ticket.priority}</strong> · cat. {ticket.category}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '12px', color: '#6b7280' }}>
                            Statut
                            <select
                              disabled={busyId === ticket.id}
                              value={ticket.status}
                              onChange={(e) => onStatusChange(ticket.id, e.target.value)}
                              style={{
                                marginLeft: '8px',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '13px',
                              }}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
