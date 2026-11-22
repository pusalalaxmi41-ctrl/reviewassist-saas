import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Dumbbell, Plus } from 'lucide-react';
import type { Business } from '../types/business';
import { businessRepository } from '../services/storage';
import { isGymCategory } from '../utils/gymValidation';
import { GymOwnerWorkspace } from '../components/gym/GymOwnerWorkspace';

export default function GymOwnerDashboardPage() {
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
      const gymOnly = list.filter((b) => isGymCategory(b.category));
      const paramSlug = searchParams.get('slug');
      const match = paramSlug ? gymOnly.find((b) => b.slug === paramSlug) : null;
      if (match) {
        setSelectedSlug(match.slug);
      } else if (gymOnly.length > 0) {
        setSelectedSlug((prev) =>
          gymOnly.some((b) => b.slug === prev) ? prev : gymOnly[0].slug,
        );
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const gymBusinesses = allBusinesses.filter((b) => isGymCategory(b.category));
  const hasOtherBusinesses = allBusinesses.some(
    (b) => !isGymCategory(b.category),
  );
  const currentGym =
    gymBusinesses.find((b) => b.slug === selectedSlug) ??
    gymBusinesses[0] ??
    null;

  if (loading) {
    return (
      <div className="py-20 text-center" role="status">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-r-transparent" />
        <p className="mt-3 text-[15px] font-semibold text-slate-500">
          Loading GymOS Studio…
        </p>
      </div>
    );
  }

  if (!currentGym) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white py-14 px-6 text-center shadow-sm space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F172A] text-[#A3E635]">
          <Dumbbell className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-[24px] font-black text-slate-900">
          No Gym Registered Yet
        </h1>
        <p className="text-[14px] text-slate-600 leading-relaxed">
          Replace dusty paper membership registers with GymOS — 10-second QR
          member signups, 1-tap desk payment approval, automatic 3-day expiry
          radar, and daily digital check-ins.
        </p>
        <Link
          to="/setup?type=gym"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0F172A] px-5 py-2.5 text-[14px] font-extrabold text-[#A3E635] hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden /> Register Gym / Fitness Studio
        </Link>
      </div>
    );
  }

  return (
    <GymOwnerWorkspace
      key={currentGym.id}
      business={currentGym}
      gymBusinesses={gymBusinesses}
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
