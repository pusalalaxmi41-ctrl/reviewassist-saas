import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { MessageSquareHeart, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { supabase } from '../../lib/supabase';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-10 items-center rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] ${
    isActive
      ? 'bg-[#EEF3EC] text-[#244B40] font-semibold'
      : 'text-[#626B65] hover:bg-[#F7F7F2] hover:text-[#252B29]'
  }`;

export function Header() {
  const { user, isConfigured, signOut } = useAuth();
  const navigate = useNavigate();
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const isPlatformAdmin = Boolean(user && adminUserId === user.id);

  useEffect(() => {
    let active = true;
    if (!isConfigured || !user || !supabase) {
      return;
    }

    const currentUserId = user.id;
    supabase.rpc('is_platform_admin').then(({ data, error }) => {
      if (!active) return;
      setAdminUserId(!error && Boolean(data) ? currentUserId : null);
    });

    return () => {
      active = false;
    };
  }, [isConfigured, user]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header className="border-b border-[#DDE4DC] bg-[#FFFFFF]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-[18px] font-semibold tracking-tight text-[#252B29] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] rounded-lg"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#244B40] text-[#FFFFFF]">
            <MessageSquareHeart className="h-5 w-5" aria-hidden />
          </span>
          <span>Vitaran AI Reviews</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Main">
          <NavLink to="/dashboard" className={navClass}>
            Dashboard
          </NavLink>
          {!user && (
            <NavLink to="/setup" className={navClass}>
              Get started
            </NavLink>
          )}
          {isPlatformAdmin && (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          )}
          {isConfigured &&
            (user ? (
              <div className="flex items-center gap-3 border-l border-[#DDE4DC] pl-3 sm:pl-4">
                <span className="hidden text-[13px] text-[#626B65] sm:inline">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[13px] font-medium text-[#252B29] hover:border-[#244B40] hover:bg-[#F7F7F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#244B40] px-3.5 py-1.5 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#1C3B32] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden /> Owner Sign In
              </NavLink>
            ))}
        </nav>
      </div>
    </header>
  );
}
