/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE BACK-OFFICE — Facturation & paiements
 * ═══════════════════════════════════════════════════════════════
 */

import { useMemo, useState, useEffect } from 'react';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { billingEngine } from '@/modules/cimolace/billing/billingEngine.js';
import { InvoiceStatus } from '@/modules/cimolace/billing/billingTypes.js';

/** Montants facture : INTEGER en centimes dans le schéma. */
function formatInvoiceEUR(cents, currency = 'EUR') {
  const n = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function formatPaymentEUR(amount, currency = 'EUR') {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

const CARD = {
  flex: '1',
  minWidth: '130px',
  padding: '14px 16px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
};

export default function CimolaceAdminBilling() {
  const [tab, setTab] = useState('invoices');
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [inv, pay] = await Promise.all([
          billingEngine.getAllInvoices(),
          billingEngine.getAllPayments(),
        ]);
        setInvoices(inv);
        setPayments(pay);
      } catch (e) {
        console.error(e);
        setError(e.message || 'Chargement impossible');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const invStats = useMemo(() => {
    const overdue = invoices.filter((i) => String(i.status) === InvoiceStatus.OVERDUE).length;
    const pendingPay = invoices.filter((i) => {
      const st = String(i.status);
      return st === InvoiceStatus.PENDING && i.due_date && new Date(i.due_date) < new Date();
    }).length;
    const paid = invoices.filter((i) => String(i.status) === InvoiceStatus.PAID).length;
    return { overdue, overdueish: overdue + pendingPay, paid, total: invoices.length };
  }, [invoices]);

  const payStats = useMemo(() => {
    const pending = payments.filter((p) => String(p.status) === 'pending' || String(p.status) === 'processing').length;
    return { total: payments.length, pending };
  }, [payments]);

  const tabBtn = (active) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    backgroundColor: active ? '#1d4ed8' : 'white',
    color: active ? 'white' : '#374151',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <CimolaceHeader />
      <div style={{ display: 'flex', flex: 1 }}>
        <CimolaceSidebar />
        <div style={{ padding: '20px', flex: 1, maxWidth: '1100px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#111827' }}>Facturation</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
            Factures (montants stockés en <strong>centimes</strong> côté base). Paiements en euros décimaux.
          </p>

          {error ? (
            <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            <button type="button" style={tabBtn(tab === 'invoices')} onClick={() => setTab('invoices')}>
              Factures ({invoices.length})
            </button>
            <button type="button" style={tabBtn(tab === 'payments')} onClick={() => setTab('payments')}>
              Paiements ({payments.length})
            </button>
          </div>

          {tab === 'invoices' ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div style={CARD}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{loading ? '…' : invStats.total}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Factures</div>
                </div>
                <div style={CARD}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b45309' }}>{loading ? '…' : invStats.overdueish}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>À suivre / en retard</div>
                </div>
                <div style={CARD}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#166534' }}>{loading ? '…' : invStats.paid}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Payées</div>
                </div>
              </div>
              <div style={{ backgroundColor: 'white', padding: '18px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                {loading ? (
                  <p style={{ color: '#6b7280' }}>Chargement…</p>
                ) : invoices.length === 0 ? (
                  <p style={{ color: '#6b7280', margin: 0 }}>Aucune facture.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {invoices.map((invoice) => {
                      const site = invoice.cimolace_sites;
                      const tenant = site?.cimolace_tenants;
                      const st = String(invoice.status);
                      const chip = {
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: st === 'paid' ? '#dcfce7' : st === 'overdue' ? '#ffedd5' : '#f3f4f6',
                        color: st === 'paid' ? '#166534' : st === 'overdue' ? '#9a3412' : '#374151',
                      };
                      return (
                        <div
                          key={invoice.id}
                          style={{
                            padding: '14px',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            backgroundColor: '#fafafa',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '12px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: '#111827' }}>{invoice.invoice_number}</div>
                            <div style={{ fontSize: '15px', color: '#374151', marginTop: '4px' }}>
                              {formatInvoiceEUR(invoice.amount, invoice.currency)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                              {site ? `${site.name}${tenant ? ` · ${tenant.name}` : ''}` : 'Site inconnu'} ·{' '}
                              échéance {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('fr-FR') : '—'} ·{' '}
                              {invoice.type}
                            </div>
                          </div>
                          <span style={chip}>{invoice.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div style={CARD}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{loading ? '…' : payStats.total}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Paiements</div>
                </div>
                <div style={CARD}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#b45309' }}>{loading ? '…' : payStats.pending}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>En attente / traitement</div>
                </div>
              </div>
              <div style={{ backgroundColor: 'white', padding: '18px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                {loading ? (
                  <p style={{ color: '#6b7280' }}>Chargement…</p>
                ) : payments.length === 0 ? (
                  <p style={{ color: '#6b7280', margin: 0 }}>Aucun paiement.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {payments.map((p) => {
                      const site = p.cimolace_sites;
                      const tenant = site?.cimolace_tenants;
                      const st = String(p.status);
                      const chip = {
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: st === 'confirmed' ? '#dcfce7' : st === 'failed' ? '#fee2e2' : '#fef3c7',
                        color: st === 'confirmed' ? '#166534' : st === 'failed' ? '#991b1b' : '#92400e',
                      };
                      return (
                        <div
                          key={p.id}
                          style={{
                            padding: '14px',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            backgroundColor: '#fafafa',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '12px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>{formatPaymentEUR(p.amount, p.currency)}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                              {p.type} · {p.provider}
                              {p.invoice_number ? ` · ${p.invoice_number}` : ''}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                              {site ? `${site.name}${tenant ? ` · ${tenant.name}` : ''}` : 'Pas de site'}
                            </div>
                          </div>
                          <span style={chip}>{p.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
