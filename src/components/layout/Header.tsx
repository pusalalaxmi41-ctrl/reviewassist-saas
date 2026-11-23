import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  Coffee,
  Scissors,
  Dumbbell,
  LogOut,
  LogIn,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-8.5 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-[13px] font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] ${
    isActive
      ? 'bg-[#1E1B4B] text-[#FFFFFF]'
      : 'text-[#4B5563] hover:bg-slate-100 hover:text-[#111827]'
  }`;

export function Header() {
  const { user, isConfigured, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#FFFFFF]">
      <div className="flex h-13 w-full items-center justify-between gap-2 px-3 sm:px-5">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 text-[15px] sm:text-[17px] font-bold tracking-tight text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] rounded-lg"
        >
          <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-[#1E1B4B] text-[#D2DB76]">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span className="truncate">Vitaran</span>
          <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 md:inline-block">
            Local OS
          </span>
        </Link>
        <nav
          className="flex shrink-0 items-center gap-1 sm:gap-1.5 overflow-x-auto"
          aria-label="Main"
        >
          <NavLink to="/dashboard" className={navClass}>
            <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Restaurants</span>
            <span className="sm:hidden">Bistro</span>
          </NavLink>
          <NavLink to="/cafe/dashboard" className={navClass}>
            <Coffee className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">CafeOS</span>
            <span className="sm:hidden">Cafe</span>
          </NavLink>
          <NavLink to="/barber/dashboard" className={navClass}>
            <Scissors className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">BarberOS</span>
            <span className="sm:hidden">Barber</span>
          </NavLink>
          <NavLink to="/gym/dashboard" className={navClass}>
            <Dumbbell className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">GymOS</span>
            <span className="sm:hidden">Gym</span>
          </NavLink>
          {!user && (
            <NavLink to="/setup" className={navClass}>
              Add Business
            </NavLink>
          )}
          {isConfigured &&
            (user ? (
              <div className="flex items-center gap-2.5 border-l border-slate-200 pl-2.5 sm:pl-3">
                <span className="hidden text-[12px] font-medium text-slate-500 lg:inline">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-3 text-[12.5px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E] transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden /> Sign In
              </NavLink>
            ))}
        </nav>
      </div>
    </header>
  );
}
