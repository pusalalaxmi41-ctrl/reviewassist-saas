import { Link, NavLink, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../../context/useAuth';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-9 sm:min-h-10 items-center rounded-xl px-3 sm:px-3.5 py-1.5 text-[13px] sm:text-[14px] font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] ${
    isActive
      ? 'bg-[#1E1B4B] text-[#FFFFFF] font-semibold shadow-sm'
      : 'text-[#6B7280] hover:bg-[#1E1B4B]/[0.05] hover:text-[#111827]'
  }`;

export function Header() {
  const { user, isConfigured, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#1E1B4B]/[0.08] bg-[#FFFFFF]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 text-[15px] sm:text-[18px] font-bold tracking-tight text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] rounded-xl"
        >
          <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76] shadow-sm">
            <UtensilsCrossed className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden />
          </span>
          <span className="truncate">Vitaran</span>
          <span className="hidden rounded-full bg-[#D2DB76]/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#1E1B4B] sm:inline-block">
            BistroOS
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2.5" aria-label="Main">
          <NavLink to="/dashboard" className={navClass}>
            Workspace
          </NavLink>
          {!user && (
            <NavLink to="/setup" className={navClass}>
              Add Restaurant
            </NavLink>
          )}
          {isConfigured &&
            (user ? (
              <div className="flex items-center gap-3 border-l border-[#1E1B4B]/10 pl-3 sm:pl-4">
                <span className="hidden text-[13px] font-medium text-[#6B7280] sm:inline">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#1E1B4B]/15 bg-[#FFFFFF] px-3 py-1.5 text-[13px] font-medium text-[#111827] hover:border-[#1E1B4B] hover:bg-[#F8F9FA] active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-3.5 py-1.5 text-[13px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B]"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden /> Owner Sign In
              </NavLink>
            ))}
        </nav>
      </div>
    </header>
  );
}
