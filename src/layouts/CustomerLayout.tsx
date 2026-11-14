import { Outlet } from 'react-router-dom';

/** Minimal, distraction-free layout for customer-facing pages. */
export function CustomerLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:py-12">
        <Outlet />
      </main>
      <footer className="pb-6 text-center text-xs text-slate-400">Powered by ReviewAssist</footer>
    </div>
  );
}
