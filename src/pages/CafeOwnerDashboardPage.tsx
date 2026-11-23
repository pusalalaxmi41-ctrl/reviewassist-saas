import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Coffee, Plus } from 'lucide-react';
import type { Business } from '../types/business';
import { businessRepository } from '../services/storage';
import { isCafeCategory } from '../utils/cafeValidation';
import { CafeManagerView } from '../components/cafe/CafeManagerView';

export default function CafeOwnerDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>(
    searchParams.get('slug') || '',
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const list = await businessRepository.getBusinesses();
      if (cancelled) return;
      setAllBusinesses(list);
      const cafesOnly = list.filter((b) => isCafeCategory(b.category));
      const paramSlug = searchParams.get('slug');
      const match = paramSlug
        ? cafesOnly.find((b) => b.slug === paramSlug)
        : null;
      if (match) {
        setSelectedSlug(match.slug);
      } else if (cafesOnly.length > 0) {
        setSelectedSlug((prev) =>
          cafesOnly.some((b) => b.slug === prev) ? prev : cafesOnly[0].slug,
        );
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const cafeBusinesses = allBusinesses.filter((b) => isCafeCategory(b.category));
  const hasOtherBusinesses = allBusinesses.some(
    (b) => !isCafeCategory(b.category),
  );
  const currentCafe =
    cafeBusinesses.find((b) => b.slug === selectedSlug) ??
    cafeBusinesses[0] ??
    null;

  if (loading) {
    return (
      <div className="py-20 text-center" role="status">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1E1B4B] border-r-transparent" />
        <p className="mt-3 text-[14px] font-medium text-slate-500">
          Loading CafeOS Studio…
        </p>
      </div>
    );
  }

  if (!currentCafe) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-xl border border-slate-200 bg-white py-14 px-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
            <Coffee className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-[22px] font-bold text-[#111827]">
            No Cafe Registered Yet
          </h1>
          <p className="text-[13.5px] text-slate-500 leading-relaxed">
            Launch CafeOS with a phone wallet Digital Coffee Stamp Card,
            automatic Birthday Free Coffee, 30-second anti-fraud counter QR, and
            live beans/milk/cup inventory alerts.
          </p>
          <Link
            to="/setup"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1E1B4B] px-5 text-[13.5px] font-semibold text-[#D2DB76] hover:bg-[#2E2A6E]"
          >
            <Plus className="h-4 w-4" aria-hidden /> Register Cafe / Coffee Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CafeManagerView
      key={currentCafe.id}
      business={currentCafe}
      cafeBusinesses={cafeBusinesses}
      hasOtherBusinesses={hasOtherBusinesses}
      onSelectBusiness={(slug) => {
        setSelectedSlug(slug);
        setSearchParams({ slug });
      }}
      onBusinessUpdated={(updated) => {
        setAllBusinesses((prev) =>
          prev.map((b) => (b.id === updated.id ? updated : b)),
        );
      }}
    />
  );
}
