import { Link } from 'react-router-dom';
import {
  UtensilsCrossed,
  Gamepad2,
  Star,
  Sparkles,
  ArrowRight,
  Smartphone,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="space-y-12 py-6 sm:py-10 animate-fadeSlideUp">
      <section className="bistro-card mx-auto max-w-4xl p-8 text-center sm:p-14">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#1E1B4B]/10 bg-[#D2DB76]/45 px-4 py-1.5 text-[13px] font-semibold text-[#1E1B4B]">
          <UtensilsCrossed className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
          <span>Vitaran BistroOS • Commercial Hospitality Platform</span>
        </div>

        <h1 className="mx-auto mt-6 max-w-2xl text-[32px] font-extrabold tracking-tight text-[#111827] sm:text-[44px] leading-[1.12]">
          The All-in-One Restaurant Digital Menu, Table Gaming, Loyalty &amp; AI Review Platform.
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#6B7280] sm:text-[17px]">
          Turn every table QR scan into a delightful guest experience. Showcase your live digital menu, entertain diners with table games, reward verified visits with Loyalty Stars, and capture authentic Google reviews effortlessly.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3.5 sm:flex-row">
          <Link
            to="/setup"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1E1B4B] px-7 py-3 text-[15px] font-semibold text-[#FFFFFF] shadow-sm transition-all duration-150 hover:bg-[#2E2A6E] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] focus-visible:ring-offset-2"
          >
            Launch Your Restaurant <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to="/r/the-urban-kitchen/menu"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-7 py-3 text-[15px] font-semibold text-[#111827] transition-all duration-150 hover:border-[#1E1B4B] hover:bg-[#F8F9FA] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] focus-visible:ring-offset-2"
          >
            <Smartphone className="h-4 w-4 text-[#1E1B4B]" aria-hidden /> Preview Guest Table Hub
          </Link>
        </div>
      </section>

      <section
        aria-label="Core platform capabilities"
        className="grid gap-6 sm:grid-cols-3"
      >
        <div className="bistro-card p-7 space-y-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76] shadow-sm">
            <UtensilsCrossed className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-[18px] font-bold text-[#111827]">
            Menu-First Table QR Hub
          </h2>
          <p className="text-[14px] leading-relaxed text-[#6B7280]">
            Guests scan their table standee to browse your live menu with dietary filters, copy Guest Wi-Fi in one tap, or call a waiter—with zero app download or clunky self-checkout cart.
          </p>
        </div>

        <div className="bistro-card p-7 space-y-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76] shadow-sm">
            <Gamepad2 className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-[18px] font-bold text-[#111827]">
            Table Games &amp; Loyalty Stars
          </h2>
          <p className="text-[14px] leading-relaxed text-[#6B7280]">
            Keep tables engaged while food is prepared with quick trivia and memory challenges. Diners convert Game Points into Loyalty Stars and unlock staff-verified dining perks.
          </p>
        </div>

        <div className="bistro-card p-7 space-y-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76] shadow-sm">
            <Star className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-[18px] font-bold text-[#111827]">
            Authentic AI Google Reviews
          </h2>
          <p className="text-[14px] leading-relaxed text-[#6B7280]">
            Guests speak or type their dining experience in seconds. AI polishes their own words into a natural review draft ready to paste on Google Maps, while owners get instant reply drafts.
          </p>
        </div>
      </section>

      <section className="bistro-card mx-auto max-w-4xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D2DB76]/45 text-[#1E1B4B]">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-[15px] font-bold text-[#111827]">
              Already managing a restaurant on Vitaran?
            </p>
            <p className="text-[13px] text-[#6B7280]">
              Open your Live Overview, Digital Menu, Table QRs, and Waiter Floor Map.
            </p>
          </div>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#1E1B4B] px-5 py-2.5 text-[14px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all duration-150"
        >
          Open Owner Workspace <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
