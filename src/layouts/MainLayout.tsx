import { Outlet } from 'react-router-dom';
import { Header } from '../components/layout/Header';

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F2] text-[#252B29]">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
