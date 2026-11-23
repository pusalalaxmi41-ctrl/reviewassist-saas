import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '../components/layout/Header';

export function MainLayout() {
  const location = useLocation();
  const isFullBleedWorkspace =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/cafe/dashboard') ||
    location.pathname.startsWith('/barber/dashboard') ||
    location.pathname.startsWith('/gym/dashboard');

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA] text-[#111827]">
      <Header />
      <main
        className={
          isFullBleedWorkspace
            ? 'w-full flex-1 p-0'
            : 'mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6'
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
