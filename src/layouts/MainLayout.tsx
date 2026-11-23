import { Outlet } from 'react-router-dom';
import { Header } from '../components/layout/Header';

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA] text-[#111827]">
      <Header />
      <main className="w-full flex-1 px-3 py-4 sm:px-5 sm:py-5">
        <Outlet />
      </main>
    </div>
  );
}
