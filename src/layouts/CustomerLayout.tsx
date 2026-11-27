import { Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

/** Friendly, welcoming, distraction-free, mobile-first layout for customer-facing review pages (/r/:businessSlug). */
export function CustomerLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA] font-sans text-slate-900 antialiased selection:bg-[#D2DB76]/40 selection:text-[#1E1B4B]">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-xl space-y-1 px-4 pb-8 pt-2 text-center font-sans text-xs text-slate-500">
        <p className="inline-flex items-center justify-center gap-1.5 font-medium text-slate-700">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-700" aria-hidden />
          <span>You stay in full control — nothing is posted without your approval.</span>
        </p>
        <p className="leading-relaxed text-slate-500">
          Your notes are used only to draft your review and are automatically purged after 90 days.
        </p>
      </footer>
    </div>
  );
}
