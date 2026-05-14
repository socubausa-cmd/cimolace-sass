/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE CLIENT DASHBOARD
 * Paramètre d’URL : UUID client, email, ou portal_slug (ex. isna après migration portal_slug).
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { clientEngine } from '@/modules/cimolace/clients/clientEngine.js';

export default function CimolaceClientDashboard() {
  const { clientSlug: clientSlugRaw } = useParams();
  const clientKey = useMemo(() => decodeURIComponent(clientSlugRaw || '').trim(), [clientSlugRaw]);

  const [client, setClient] = useState(null);
  const [stats, setStats] = useState({
    sites: 0,
    tickets: 0,
    invoices: 0,
    incidents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setLoading(true);
      setNotFound(false);
      setFetchError(null);

      try {
        const resolved = await clientEngine.resolveClientRef(clientKey);

        if (cancelled) return;

        if (!resolved) {
          setClient(null);
          setStats({ sites: 0, tickets: 0, invoices: 0, incidents: 0 });
          setNotFound(true);
          return;
        }

        setClient(resolved);

        const [sites, tickets, invoices] = await Promise.all([
          clientEngine.getClientSites(resolved.id),
          clientEngine.getClientTickets(resolved.id),
          clientEngine.getClientInvoices(resolved.id),
        ]);

        if (cancelled) return;

        setStats({
          sites: sites.length,
          tickets: tickets.length,
          invoices: invoices.length,
          incidents: 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        if (!cancelled) {
          setFetchError(error.message || 'Erreur réseau ou base de données');
          setClient(null);
          setStats({ sites: 0, tickets: 0, invoices: 0, incidents: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, [clientKey]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <CimolaceHeader />
      <div style={{ display: 'flex', flex: 1 }}>
        <CimolaceSidebar />
        <div style={{ padding: '20px', flex: 1, maxWidth: '960px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>
            Portail client
          </h1>

          {client ? (
            <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '14px' }}>
              {client.business_name || client.name}
              {client.email ? ` · ${client.email}` : ''}
              {client.portal_slug ? (
                <>
                  {' '}
                  · slug&nbsp;:{' '}
                  <code style={{ fontSize: '13px', backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>
                    {client.portal_slug}
                  </code>
                </>
              ) : null}
            </p>
          ) : (
            <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '14px' }}>
              Identifiant demandé&nbsp;:{' '}
              <code style={{ fontSize: '13px', backgroundColor: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>
                {clientKey || '—'}
              </code>
            </p>
          )}

          {fetchError ? (
            <div
              role="alert"
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px',
                color: '#b91c1c',
              }}
            >
              {fetchError}
            </div>
          ) : null}

          {notFound && !fetchError ? (
            <div
              role="alert"
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fcd34d',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px',
                color: '#92400e',
              }}
            >
              <strong>Client introuvable.</strong> Utilisez l’UUID du client, son email ou un{' '}
              <code style={{ fontSize: '13px' }}>portal_slug</code> défini dans CIMOLACE (ex.&nbsp;:{' '}
              <Link to="/cimolace/client/isna">/cimolace/client/isna</Link>). Après ajout du slug en base,
              exécutez la migration&nbsp;
              <code style={{ fontSize: '13px' }}>202605011200_cimolace_clients_portal_slug.sql</code>.
            </div>
          ) : null}

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '12px', color: '#111827' }}>Statistiques</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {loading ? '…' : stats.sites}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Sites (contrats)</div>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {loading ? '…' : stats.tickets}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Tickets</div>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {loading ? '…' : stats.invoices}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Factures</div>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                  {loading ? '…' : stats.incidents}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Incidents</div>
              </div>
            </div>
          </div>

          {client?.portal_slug ? (
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '14px' }}>
              <p style={{ margin: 0, color: '#4b5563' }}>
                Espace métier (formation / école)&nbsp;:{' '}
                <Link to={`/t/${encodeURIComponent(client.portal_slug)}/admin`} style={{ color: '#2563eb' }}>
                  Ouvrir /t/{client.portal_slug}/admin
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
