import { useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      return;
    }

    let mounted = true;

    void client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(
    email: string,
    password: string,
  ): Promise<{ error: string | null }> {
    if (!supabase) {
      return { error: 'Supabase is not configured.' };
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error ? error.message : null };
  }

  async function signUp(
    email: string,
    password: string,
  ): Promise<{ error: string | null; needsEmailConfirmation: boolean }> {
    if (!supabase) {
      return {
        error: 'Supabase is not configured.',
        needsEmailConfirmation: false,
      };
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      return { error: error.message, needsEmailConfirmation: false };
    }
    const needsEmailConfirmation = Boolean(data.user && !data.session);
    return { error: null, needsEmailConfirmation };
  }

  async function signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
