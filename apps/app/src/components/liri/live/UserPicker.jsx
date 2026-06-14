import React, { useState, useEffect, useRef } from 'react';
import { Search, X, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useProfilesSearch } from '@/hooks/useProfilesSearch';
import { cn } from '@/lib/utils';

export function UserPicker({ selected = [], onChange, placeholder = 'Rechercher par nom ou email...', maxHeight = '200px' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { results, loading, search } = useProfilesSearch();
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const selectedIds = selected.map((u) => (typeof u === 'object' ? u.id : u));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addUser = (p) => {
    if (selectedIds.includes(p.id)) return;
    onChange([...selected, p]);
    setQuery('');
  };

  const removeUser = (id) => {
    onChange(selected.filter((u) => (typeof u === 'object' ? u.id : u) !== id));
  };

  const filteredResults = results.filter((r) => !selectedIds.includes(r.id));

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-2 mb-2 min-h-[36px]">
        {selected.map((u) => {
          const p = typeof u === 'object' ? u : { id: u, name: u, email: '' };
          return (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] text-sm"
            >
              {p.name || p.email || String(p.id).slice(0, 8)}
              <button type="button" onClick={() => removeUser(p.id)} className="hover:opacity-80">
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9 h-10 rounded-xl bg-[#0F1419] border-white/10 text-white"
        />
      </div>
      {open && (query.length >= 2 || loading) && (
        <div
          className={cn(
            'absolute z-[1100] mt-1 w-full rounded-xl bg-[#151a21] border border-white/10 shadow-xl overflow-y-auto',
            maxHeight
          )}
          style={{ maxHeight }}
        >
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-sm">Recherche...</div>
          ) : filteredResults.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              {query.length < 2 ? 'Tapez 2 caractères minimum' : 'Aucun résultat'}
            </div>
          ) : (
            filteredResults.slice(0, 15).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addUser(p)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#D4AF37]/10 text-left text-white text-sm"
              >
                <UserPlus className="w-4 h-4 text-[#D4AF37]/80 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name || 'Sans nom'}</div>
                  <div className="text-xs text-gray-400 truncate">{p.email}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
