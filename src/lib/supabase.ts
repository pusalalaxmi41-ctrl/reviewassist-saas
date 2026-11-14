import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

/**
 * Returns true when both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
 * are present in the environment.
 */
export const isSupabaseConfigured: boolean = Boolean(supabaseUrl && supabasePublishableKey);

/**
 * Supabase client initialized with the project URL and publishable (anon) key.
 * Null until environment variables are populated in `.env.local`.
 *
 * Security rule: Only use the public/publishable key here with RLS enabled.
 * Never place service_role keys or database passwords in frontend code.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;
