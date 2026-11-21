import { Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

/** Friendly, welcoming, distraction-free, mobile-first layout for customer-facing review pages (/r/:businessSlug). */
export function CustomerLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8F9FA] text-[#111827] antialiased selection:bg-[#D2DB76]/40 selection:text-[#1E1B4B]">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-12">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-xl space-y-1.5 px-4 pb-8 pt-2 text-center text-[13px] text-[#6B7280]">
        <p className="inline-flex items-center justify-center gap-1.5 font-medium text-[#111827]">
          <ShieldCheck className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
          <span>You stay in full control — nothing is posted without your approval.</span>
        </p>
        <p className="text-[13px] leading-relaxed text-[#6B7280]">
          Your notes are used only to draft your review and are automatically purged after 90 days.
        </p>
      </footer>
    </div>
  );
}
