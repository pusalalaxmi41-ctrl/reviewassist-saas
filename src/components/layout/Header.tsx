import { Link, NavLink, useNavigate } from 'react-router-dom';
import { MessageSquareHeart, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../../context/useAuth';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`;

export function Header() {
  const { user, isConfigured, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <MessageSquareHeart className="h-6 w-6 text-indigo-600" aria-hidden />
          ReviewAssist
        </Link>
        <nav className="flex items-center gap-5" aria-label="Main">
          <NavLink to="/dashboard" className={navClass}>
            Dashboard
          </NavLink>
          <NavLink to="/setup" className={navClass}>
            Get started
          </NavLink>
          {isConfigured &&
            (user ? (
              <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                <span className="hidden text-xs text-slate-500 sm:inline">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                <LogIn className="h-3.5 w-3.5" /> Owner Sign In
              </NavLink>
            ))}
        </nav>
      </div>
    </header>
  );
}
