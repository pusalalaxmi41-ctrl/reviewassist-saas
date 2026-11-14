import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, isConfigured } = useAuth();
  const location = useLocation();

  // If Supabase is not configured in .env.local, allow local demo mode
  if (!isConfigured) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
        <p className="mt-3 text-sm text-slate-500">Checking owner session...</p>
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}
