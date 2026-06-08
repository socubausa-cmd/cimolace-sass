import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase (mobile). URL + clé anon sont des valeurs PUBLIQUES côté client
 * (protégées par RLS) — mêmes que l'app web. Surchargeables via EXPO_PUBLIC_*.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://fwfupxvmwtxbtbjdeqvu.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3ZnVweHZtd3R4YnRiamRlcXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTE0NjgsImV4cCI6MjA5MzU2NzQ2OH0.dIx65qw4ii0Q0GyLkqnNi41FuYDa4wTMjtmQ9CUXukA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
