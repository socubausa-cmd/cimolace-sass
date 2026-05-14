import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  eleveLiveImmersivePath,
  setStoredImmersiveMode,
} from '@/lib/eleveLiveImmersive';

const TABS = [
  { id: 'default', label: 'Immersif' },
  { id: 'alpha', label: 'Alpha' },
];

/**
 * Bascule **Immersif (référence)** ⟷ **Alpha** sur les maquettes salle live (`/m/eleve/live/maquette/...`).
 * Synchronise `localStorage` (comme le menu Profil).
 *
 * @param {object} props
 * @param {'default' | 'alpha'} props.active
 * @param {string} [props.className]
 */
export function LiveImmersiveScreenSwitcher({ active, className }) {
  const navigate = useNavigate();

  const go = (id) => {
    if (id === active) return;
    if (id !== 'default' && id !== 'alpha') return;
    setStoredImmersiveMode(id);
    navigate(eleveLiveImmersivePath(id), { replace: true });
  };

  return (
    <div
      className={cn('mx-auto flex w-full max-w-md justify-center px-3 pb-2', className)}
      role="tablist"
      aria-label="Variante d’affichage immersif"
    >
      <div
        className="inline-flex w-full max-w-[280px] rounded-full border p-0.5"
        style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.35)' }}
      >
        {TABS.map((tab) => {
          const on = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => go(tab.id)}
              className={cn(
                'min-w-0 flex-1 rounded-full py-1.5 text-center text-[11px] font-semibold transition',
                on ? 'text-white shadow-sm' : 'text-white/45',
              )}
              style={
                on
                  ? {
                      background: 'linear-gradient(180deg, rgba(123, 97, 255, 0.45) 0%, rgba(99, 57, 249, 0.35) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                    }
                  : { background: 'transparent' }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
