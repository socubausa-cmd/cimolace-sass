import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { livesApi } from '@/lib/api';

export function DashboardLivesNew() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [priceEuros, setPriceEuros] = useState('');
  const [capacity, setCapacity] = useState('');

  const mutation = useMutation({
    mutationFn: livesApi.create,
    onSuccess: () => navigate('/dashboard/lives'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      title,
      scheduledAt: new Date(scheduledAt).toISOString(),
      priceCents: Math.round(parseFloat(priceEuros || '0') * 100),
      currency: 'EUR',
      capacity: capacity && parseInt(capacity, 10) > 0 ? parseInt(capacity, 10) : undefined,
    });
  };

  const field = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Créer un live</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              className={field} placeholder="Ex : Masterclass React avancé" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure</label>
            <input type="datetime-local" required value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)} className={field} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix (€)</label>
            <input type="number" min="0" step="0.01" value={priceEuros}
              onChange={(e) => setPriceEuros(e.target.value)} className={field} placeholder="0.00" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacité <span className="text-gray-400">(0 = illimitée)</span>
            </label>
            <input type="number" min="0" value={capacity}
              onChange={(e) => setCapacity(e.target.value)} className={field} placeholder="0" />
          </div>

          {mutation.isError && (
            <p className="text-red-600 text-sm">{mutation.error.message}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {mutation.isPending ? 'Création…' : 'Créer le live'}
            </button>
            <button type="button" onClick={() => navigate('/dashboard/lives')}
              className="px-6 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
