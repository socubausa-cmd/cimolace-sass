/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE BACK-OFFICE - CLIENTS
 * Liste + création rapide
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { clientEngine } from '@/modules/cimolace/clients/clientEngine.js';
import { ClientStatus, ClientType } from '@/modules/cimolace/clients/clientTypes.js';

const clientTypeOptions = Object.entries(ClientType).map(([k, v]) => ({
  label: k === 'OTHER' ? 'Autre' : k.charAt(0) + k.slice(1).toLowerCase(),
  value: v,
}));

export default function CimolaceAdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    business_name: '',
    client_type: ClientType.SCHOOL,
    portal_slug: '',
    status: ClientStatus.ACTIVE,
  });

  async function refresh() {
    const data = await clientEngine.getAllClients();
    setClients(data);
  }

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (error) {
        console.error('Error fetching clients:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await clientEngine.createClient({
        name: form.name.trim(),
        email: form.email.trim(),
        business_name: form.business_name.trim() || undefined,
        client_type: form.client_type,
        status: form.status,
        portal_slug: form.portal_slug.trim() || undefined,
      });
      setForm({
        name: '',
        email: '',
        business_name: '',
        client_type: ClientType.SCHOOL,
        portal_slug: '',
        status: ClientStatus.ACTIVE,
      });
      setShowForm(false);
      await refresh();
    } catch (err) {
      setFormError(err.message || 'Création impossible (email dupliqué ou erreur réseau)');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <CimolaceHeader />
      <div style={{ display: 'flex', flex: 1 }}>
        <CimolaceSidebar />
        <div style={{ padding: '20px', flex: 1, maxWidth: '960px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Clients</h1>
            <button
              type="button"
              onClick={() => {
                setShowForm((v) => !v);
                setFormError(null);
              }}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {showForm ? 'Fermer le formulaire' : '+ Nouveau client'}
            </button>
          </div>

          {showForm ? (
            <form
              onSubmit={handleCreate}
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #e5e7eb',
                display: 'grid',
                gap: '12px',
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0', color: '#111827' }}>Nouveau client</h2>
              {formError ? (
                <p style={{ margin: 0, color: '#b91c1c', fontSize: '13px' }}>{formError}</p>
              ) : null}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#374151' }}>
                Nom *
                <input
                  required
                  value={form.name}
                  onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#374151' }}>
                Email *
                <input type="email" required value={form.email} onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))} style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#374151' }}>
                Raison sociale
                <input value={form.business_name} onChange={(ev) => setForm((f) => ({ ...f, business_name: ev.target.value }))} style={inputStyle} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#374151' }}>
                  Type
                  <select value={form.client_type} onChange={(ev) => setForm((f) => ({ ...f, client_type: ev.target.value }))} style={inputStyle}>
                    {clientTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#374151' }}>
                  Statut
                  <select value={form.status} onChange={(ev) => setForm((f) => ({ ...f, status: ev.target.value }))} style={inputStyle}>
                    <option value={ClientStatus.PROSPECT}>Prospect</option>
                    <option value={ClientStatus.CONFIGURING}>Configuration</option>
                    <option value={ClientStatus.ACTIVE}>Actif</option>
                    <option value={ClientStatus.SUSPENDED}>Suspendu</option>
                    <option value={ClientStatus.CANCELLED}>Annulé</option>
                  </select>
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#374151' }}>
                Portal slug (URL portail&nbsp;: /cimolace/client/… )
                <input
                  placeholder="ex. isna"
                  value={form.portal_slug}
                  onChange={(ev) => setForm((f) => ({ ...f, portal_slug: ev.target.value }))}
                  style={inputStyle}
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                style={{
                  marginTop: '8px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: saving ? '#93c5fd' : '#1d4ed8',
                  color: 'white',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Enregistrement…' : 'Créer le client'}
              </button>
            </form>
          ) : null}

          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            {loading ? (
              <p style={{ color: '#6b7280' }}>Chargement...</p>
            ) : clients.length === 0 ? (
              <p style={{ color: '#6b7280' }}>Aucun client pour le moment. Utilise « Nouveau client » ci-dessus.</p>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {clients.map((client) => (
                  <Link
                    key={client.id}
                    to={`/cimolace/admin/clients/${client.id}`}
                    style={{
                      padding: '16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textDecoration: 'none',
                      color: 'inherit',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{client.name}</div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>{client.email}</div>
                      {client.portal_slug ? (
                        <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '6px' }}>
                          slug&nbsp;: /cimolace/client/{client.portal_slug}
                        </div>
                      ) : null}
                    </div>
                    <div style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      backgroundColor: client.status === 'active' ? '#dcfce7' : '#fef3c7',
                      color: client.status === 'active' ? '#166534' : '#92400e',
                    }}>
                      {client.status}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontSize: '14px',
};
