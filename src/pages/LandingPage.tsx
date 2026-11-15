import { Link } from 'react-router-dom';
import {
  MessageSquareHeart,
  QrCode,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="space-y-12 py-6 sm:py-10">
      <section className="mx-auto max-w-3xl rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-8 text-center shadow-2xs sm:p-12">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#E4BD63] bg-[#FAF3DF] px-3.5 py-1 text-[13px] font-medium text-[#252B29]">
          <MessageSquareHeart className="h-4 w-4 text-[#244B40]" aria-hidden />
          <span>Hospitality &amp; Local Business Feedback Platform</span>
        </div>

        <h1 className="mt-5 text-[30px] font-bold tracking-tight text-[#252B29] sm:text-[36px] leading-tight">
          Making customer feedback simple for people and meaningful for businesses.
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#626B65] sm:text-[16px]">
          Vitaran AI Reviews helps guests share honest experiences in seconds and gives restaurants, cafes, hotels, and PG accommodations organised insights and respectful AI response drafts.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/setup"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#244B40] px-6 py-2.5 text-[15px] font-medium text-[#FFFFFF] hover:bg-[#1C3B32] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] focus-visible:ring-offset-2"
          >
            Register your business <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to="/r/the-urban-kitchen"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-6 py-2.5 text-[15px] font-medium text-[#252B29] hover:border-[#244B40] hover:bg-[#F7F7F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] focus-visible:ring-offset-2"
          >
            Preview customer page
          </Link>
        </div>
      </section>

      <section
        aria-label="Core principles"
        className="grid gap-5 sm:grid-cols-3"
      >
        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 space-y-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#A8BFA5] bg-[#EEF3EC] text-[#244B40]">
            <QrCode className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-[18px] font-semibold text-[#252B29]">
            Effortless QR &amp; Voice Input
          </h2>
          <p className="text-[14px] leading-relaxed text-[#626B65]">
            Guests scan your table or reception QR code and share their thoughts by typing or speaking naturally in their browser.
          </p>
        </div>

        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 space-y-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#A8BFA5] bg-[#EEF3EC] text-[#244B40]">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-[18px] font-semibold text-[#252B29]">
            Authentic AI Drafting
          </h2>
          <p className="text-[14px] leading-relaxed text-[#626B65]">
            Drafts are shaped strictly from the guest&apos;s own words — never fabricated or gated — and owners can prepare tailored replies.
          </p>
        </div>

        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 space-y-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#A8BFA5] bg-[#EEF3EC] text-[#244B40]">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-[18px] font-semibold text-[#252B29]">
            Respectful &amp; Transparent
          </h2>
          <p className="text-[14px] leading-relaxed text-[#626B65]">
            Customers stay in complete control of what they copy and post, with automatic 90-day feedback retention.
          </p>
        </div>
      </section>
    </div>
  );
}
