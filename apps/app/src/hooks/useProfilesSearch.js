import { useCallback, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export function useProfilesSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query, limit = 20) => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, avatar_url')
        .or(`name.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`)
        .limit(limit);
      if (error) throw error;
      setResults(data || []);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .in('role', ['teacher', 'owner', 'admin'])
        .order('name')
        .limit(100);
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, search, fetchTeachers };
}
