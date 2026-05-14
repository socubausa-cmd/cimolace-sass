/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE BACK-OFFICE - CLIENT DETAIL
 * Détail d'un client
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  clientEngine,
  ClientStatus,
  ClientType,
  contractEngine,
} from '@/modules/cimolace';

const clientTypeOptions = Object.entries(ClientType).map(([k, v]) => ({
  label: k === 'OTHER' ? 'Autre' : k.charAt(0) + k.slice(1).toLowerCase(),
  value: v,
}));

export default function CimolaceAdminClientDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [sites, setSites] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [subsCount, setSubsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editForm, setEditForm] = useState(null);

  useEffect(() => {
    loadClientData();
  }, [id]);

  useEffect(() => {
    setEditing(false);
    setEditError(null);
  }, [id]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      const [clientData, sitesData, contractsData, subs] = await Promise.all([
        clientEngine.getClientById(id),
        clientEngine.getClientSites(id),
        contractEngine.getContractsByClient(id),
        clientEngine.getClientSubscriptions(id),
      ]);
      setClient(clientData);
      setSites(sitesData);
      setContracts(contractsData);
      setSubsCount((subs && subs.length) || 0);
      setEditForm({
        name: clientData.name || '',
        business_name: clientData.business_name || '',
        email: clientData.email || '',
        phone: clientData.phone || '',
        country: clientData.country || '',
        portal_slug: clientData.portal_slug || '',
        client_type: clientData.client_type || ClientType.SCHOOL,
        status: clientData.status || ClientStatus.PROSPECT,
        internal_notes: clientData.internal_notes || '',
      });
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editForm) return;
    setEditError(null);
    setSavingEdit(true);
    try {
      const slug = editForm.portal_slug.trim().toLowerCase();
      const updated = await clientEngine.updateClient(id, {
        name: editForm.name.trim(),
        business_name: editForm.business_name.trim() || null,
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        country: editForm.country.trim() || null,
        portal_slug: slug === '' ? null : slug,
        client_type: editForm.client_type,
        status: editForm.status,
        internal_notes: editForm.internal_notes.trim() || null,
      });
      setClient(updated);
      setEditing(false);
    } catch (err) {
      setEditError(err.message || 'Mise à jour impossible');
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Chargement...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">Client non trouvé</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/cimolace/admin/clients')}
                className="text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                ← Retour aux Clients
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              <p className="text-sm text-gray-500">{client.email}</p>
              {client.portal_slug ? (
                <p className="text-sm mt-1">
                  <Link to={`/cimolace/client/${encodeURIComponent(client.portal_slug)}`} className="text-blue-600 hover:underline">
                    Portail client /cimolace/client/{client.portal_slug}
                  </Link>
                  {' · '}
                  <Link to={`/t/${encodeURIComponent(client.portal_slug)}/admin`} className="text-blue-600 hover:underline">
                    Métier /t/{client.portal_slug}/admin
                  </Link>
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing((v) => !v);
                  setEditError(null);
                  if (!editing && client) {
                    setEditForm({
                      name: client.name || '',
                      business_name: client.business_name || '',
                      email: client.email || '',
                      phone: client.phone || '',
                      country: client.country || '',
                      portal_slug: client.portal_slug || '',
                      client_type: client.client_type || ClientType.SCHOOL,
                      status: client.status || ClientStatus.PROSPECT,
                      internal_notes: client.internal_notes || '',
                    });
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editing ? 'Annuler' : 'Modifier'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'overview', label: 'Vue d\'ensemble' },
                { id: 'sites', label: `Sites (${sites.length})` },
                { id: 'contracts', label: `Contrats (${contracts.length})` },
                { id: 'billing', label: 'Facturation' },
                { id: 'support', label: 'Support' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {editing && editForm ? (
              <form onSubmit={handleSaveEdit} className="bg-white rounded-lg shadow p-6 space-y-4">
                <h2 className="text-lg font-semibold">Modifier le client</h2>
                {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block text-sm">
                    <span className="text-gray-500">Nom</span>
                    <input
                      required
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={editForm.name}
                      onChange={(ev) => setEditForm((f) => ({ ...f, name: ev.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-500">Raison sociale</span>
                    <input
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={editForm.business_name}
                      onChange={(ev) => setEditForm((f) => ({ ...f, business_name: ev.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-500">Email</span>
                    <input
                      type="email"
                      required
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={editForm.email}
                      onChange={(ev) => setEditForm((f) => ({ ...f, email: ev.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-500">Portal slug</span>
                    <input
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      placeholder="isna"
                      value={editForm.portal_slug}
                      onChange={(ev) => setEditForm((f) => ({ ...f, portal_slug: ev.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-500">Téléphone</span>
                    <input
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={editForm.phone}
                      onChange={(ev) => setEditForm((f) => ({ ...f, phone: ev.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-500">Pays</span>
                    <input
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={editForm.country}
                      onChange={(ev) => setEditForm((f) => ({ ...f, country: ev.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-500">Type</span>
                    <select
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={editForm.client_type}
                      onChange={(ev) => setEditForm((f) => ({ ...f, client_type: ev.target.value }))}
                    >
                      {clientTypeOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-gray-500">Statut</span>
                    <select
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={editForm.status}
                      onChange={(ev) => setEditForm((f) => ({ ...f, status: ev.target.value }))}
                    >
                      <option value={ClientStatus.PROSPECT}>Prospect</option>
                      <option value={ClientStatus.CONFIGURING}>Configuration</option>
                      <option value={ClientStatus.ACTIVE}>Actif</option>
                      <option value={ClientStatus.SUSPENDED}>Suspendu</option>
                      <option value={ClientStatus.CANCELLED}>Annulé</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="text-gray-500">Notes internes</span>
                  <textarea
                    className="mt-1 w-full border rounded-lg px-3 py-2 min-h-[80px]"
                    value={editForm.internal_notes}
                    onChange={(ev) => setEditForm((f) => ({ ...f, internal_notes: ev.target.value }))}
                  />
                </label>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </form>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Informations Client</h2>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Nom" value={client.name} />
                  <InfoRow label="Business Name" value={client.business_name || '-'} />
                  <InfoRow label="Email" value={client.email} />
                  <InfoRow label="Portal slug" value={client.portal_slug || '-'} />
                  <InfoRow label="Téléphone" value={client.phone || '-'} />
                  <InfoRow label="Type" value={client.client_type} />
                  <InfoRow label="Statut" value={<StatusBadge status={client.status} />} />
                  <InfoRow label="Pays" value={client.country || '-'} />
                  <InfoRow label="Source" value={client.source || '-'} />
                  <InfoRow label="Responsable" value={client.commercial_responsible || '-'} />
                  <InfoRow label="Créé le" value={new Date(client.created_at).toLocaleDateString('fr-FR')} />
                </div>
                {client.internal_notes && (
                  <div className="mt-4 pt-4 border-t">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Notes Internes</h3>
                    <p className="text-sm text-gray-600">{client.internal_notes}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Sites (contrats)" value={sites.length} />
              <StatCard title="Contrats" value={contracts.length} />
              <StatCard title="Abonnements" value={subsCount} />
            </div>
          </div>
        )}

        {activeTab === 'sites' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sites</h2>
              <button
                onClick={() => navigate(`/cimolace/admin/sites/new?client_id=${id}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                + Nouveau Site
              </button>
            </div>
            {sites.length === 0 ? (
              <p className="text-gray-500">Aucun site pour ce client</p>
            ) : (
              <div className="space-y-4">
                {sites.map((site) => (
                  <div
                    key={site.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/cimolace/admin/sites/${site.id}`)}
                  >
                    <div>
                      <div className="font-medium text-gray-900">{site.name}</div>
                      <div className="text-sm text-gray-500">{site.domain || site.subdomain || '-'}</div>
                    </div>
                    <div className="text-sm">
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                        {site.plan}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Contrats</h2>
              <button
                onClick={() => navigate(`/cimolace/admin/contracts/new?client_id=${id}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                + Nouveau Contrat
              </button>
            </div>
            {contracts.length === 0 ? (
              <p className="text-gray-500">Aucun contrat pour ce client</p>
            ) : (
              <div className="space-y-4">
                {contracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/cimolace/admin/contracts/${contract.id}`)}
                  >
                    <div>
                      <div className="font-medium text-gray-900">{contract.contract_type}</div>
                      <div className="text-sm text-gray-500">
                        {contract.monthly_amount}€/mois
                      </div>
                    </div>
                    <div className="text-sm">
                      <StatusBadge status={contract.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Facturation</h2>
            <p className="text-gray-500">La facturation sera disponible ici.</p>
          </div>
        )}

        {activeTab === 'support' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Support</h2>
            <p className="text-gray-500">Les tickets support seront disponibles ici.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-sm text-gray-500 mb-1">{title}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const statusColors = {
    [ClientStatus.ACTIVE]: 'bg-green-100 text-green-800',
    [ClientStatus.PROSPECT]: 'bg-yellow-100 text-yellow-800',
    [ClientStatus.CONFIGURING]: 'bg-blue-100 text-blue-800',
    [ClientStatus.SUSPENDED]: 'bg-red-100 text-red-800',
    [ClientStatus.CANCELLED]: 'bg-gray-100 text-gray-800',
  };

  const statusLabels = {
    [ClientStatus.ACTIVE]: 'Actif',
    [ClientStatus.PROSPECT]: 'Prospect',
    [ClientStatus.CONFIGURING]: 'Configuration',
    [ClientStatus.SUSPENDED]: 'Suspendu',
    [ClientStatus.CANCELLED]: 'Annulé',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
      {statusLabels[status] || status}
    </span>
  );
}
