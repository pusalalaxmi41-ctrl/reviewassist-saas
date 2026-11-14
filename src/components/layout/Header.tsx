import { Link, NavLink } from 'react-router-dom';
import { MessageSquareHeart } from 'lucide-react';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`;

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <MessageSquareHeart className="h-6 w-6 text-indigo-600" aria-hidden />
          ReviewAssist
        </Link>
        <nav className="flex items-center gap-6" aria-label="Main">
          <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
          <NavLink to="/setup" className={navClass}>Get started</NavLink>
        </nav>
      </div>
    </header>
  );
}
