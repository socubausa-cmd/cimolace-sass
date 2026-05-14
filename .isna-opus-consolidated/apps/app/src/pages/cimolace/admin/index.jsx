/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE BACK-OFFICE — Dashboard propriétaire
 * ═══════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { clientEngine } from '@/modules/cimolace/clients/clientEngine.js';
import { siteEngine } from '@/modules/cimolace/sites/siteEngine.js';
import { ticketEngine } from '@/modules/cimolace/support/ticketEngine.js';
import { billingEngine } from '@/modules/cimolace/billing/billingEngine.js';
import { InvoiceStatus } from '@/modules/cimolace/billing/billingTypes.js';

const CARD = {
  flex: '1',
  minWidth: '140px',
  padding: '16px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
};

export default function CimolaceAdminDashboard() {
  const [stats, setStats] = useState({
    clients: 0,
    sites: 0,
    ticketsTotal: 0,
    ticketsOpen: 0,
    invoicesTotal: 0,
    overdueInvoices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [clients, sites, tickets, invoices] = await Promise.all([
          clientEngine.getAllClients(),
          siteEngine.getAllSites(),
          ticketEngine.getAllTickets(),
          billingEngine.getAllInvoices(),
        ]);

        const open = ['open', 'in_progress'];
        const ticketsOpen = tickets.filter((t) => open.includes(String(t.status).toLowerCase())).length;

        const overdueInvoices = invoices.filter((inv) => {
          const st = String(inv.status || '').toLowerCase();
          if (st === InvoiceStatus.OVERDUE) return true;
          if (
            st === InvoiceStatus.PENDING &&
            inv.due_date &&
            new Date(inv.due_date) < new Date()
          )
            return true;
          return false;
        }).length;

        setStats({
          clients: clients.length,
          sites: sites.length,
          ticketsTotal: tickets.length,
          ticketsOpen,
          invoicesTotal: invoices.length,
          overdueInvoices,
        });
      } catch (e) {
        console.error(e);
        setError(e.message || 'Impossible de charger les statistiques');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <CimolaceHeader />
      <div style={{ display: 'flex', flex: 1 }}>
        <CimolaceSidebar />
        <div style={{ padding: '24px', flex: 1, maxWidth: '1100px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>
            Tableau de bord propriétaire
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>
            Vue globale clients, sites, support et facturation CIMOLACE.
          </p>

          {error ? (
            <div
              role="alert"
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                marginBottom: '20px',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div style={CARD}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                {loading ? '…' : stats.clients}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Clients</div>
            </div>
            <div style={CARD}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                {loading ? '…' : stats.sites}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Sites</div>
            </div>
            <div style={CARD}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                {loading ? '…' : stats.ticketsTotal}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                Dont à traiter (ouvert ou en cours)&nbsp;: {loading ? '…' : stats.ticketsOpen}
              </div>
            </div>
            <div style={CARD}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                {loading ? '…' : stats.invoicesTotal}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Factures</div>
            </div>
            <div style={CARD}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: stats.overdueInvoices ? '#b45309' : '#111827' }}>
                {loading ? '…' : stats.overdueInvoices}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Factures à surveiller</div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>
              Raccourcis
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>
                <Link to="/cimolace/admin/clients" style={{ color: '#2563eb', fontSize: '14px', textDecoration: 'none' }}>
                  Gérer les clients →
                </Link>
              </li>
              <li>
                <Link to="/cimolace/admin/sites" style={{ color: '#2563eb', fontSize: '14px', textDecoration: 'none' }}>
                  Gérer les sites →
                </Link>
              </li>
              <li>
                <Link to="/cimolace/admin/billing" style={{ color: '#2563eb', fontSize: '14px', textDecoration: 'none' }}>
                  Billing & paiements →
                </Link>
              </li>
              <li>
                <Link to="/cimolace/admin/support" style={{ color: '#2563eb', fontSize: '14px', textDecoration: 'none' }}>
                  Support & tickets →
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
