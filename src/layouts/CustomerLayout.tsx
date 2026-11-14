import { Outlet } from 'react-router-dom';

/** Minimal, distraction-free layout for customer-facing pages. */
export function CustomerLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:py-12">
        <Outlet />
      </main>
      <footer className="space-y-1 px-4 pb-6 text-center text-xs text-slate-400">
        <p>
          Privacy note: Your experience notes are used solely to help draft your review and are automatically deleted after 90 days.
        </p>
        <p>Powered by ReviewAssist</p>
      </footer>
    </div>
  );
}
