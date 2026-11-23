import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  Scissors,
  Dumbbell,
  LogOut,
  LogIn,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-9 sm:min-h-10 items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-1.5 text-[12.5px] sm:text-[13.5px] font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] ${
    isActive
      ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm'
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
      <div className="flex h-14 sm:h-15 w-full items-center justify-between gap-2 px-3 sm:px-5">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 text-[15px] sm:text-[18px] font-bold tracking-tight text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] rounded-xl"
        >
          <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76] shadow-sm">
            <Sparkles className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden />
          </span>
          <span className="truncate">Vitaran</span>
          <span className="hidden rounded-full bg-[#1E1B4B]/[0.07] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#1E1B4B] md:inline-block">
            Local OS
          </span>
        </Link>
        <nav
          className="flex shrink-0 items-center gap-1 sm:gap-2 overflow-x-auto"
          aria-label="Main"
        >
          <NavLink to="/dashboard" className={navClass}>
            <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Restaurants</span>
            <span className="sm:hidden">Bistro</span>
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
              <div className="flex items-center gap-2.5 border-l border-[#1E1B4B]/10 pl-2.5 sm:pl-3.5">
                <span className="hidden text-[12.5px] font-medium text-[#6B7280] lg:inline">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#1E1B4B]/15 bg-[#FFFFFF] px-2.5 sm:px-3 py-1.5 text-[12.5px] font-semibold text-[#111827] hover:border-[#1E1B4B] hover:bg-[#F8F9FA] active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-3 py-1.5 text-[12.5px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B]"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden /> Sign In
              </NavLink>
            ))}
        </nav>
      </div>
    </header>
  );
}
