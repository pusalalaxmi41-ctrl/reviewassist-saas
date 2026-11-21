import { Outlet } from 'react-router-dom';
import { Header } from '../components/layout/Header';

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA] text-[#111827]">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
