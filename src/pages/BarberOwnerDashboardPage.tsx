import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Scissors, Plus } from 'lucide-react';
import type { Business } from '../types/business';
import { businessRepository } from '../services/storage';
import { isBarberOrSalonCategory } from '../utils/barberQueueValidation';
import { BarberOwnerWorkspace } from '../components/barber/BarberOwnerWorkspace';

export default function BarberOwnerDashboardPage() {
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
      const barberOnly = list.filter((b) =>
        isBarberOrSalonCategory(b.category),
      );
      const paramSlug = searchParams.get('slug');
      const match = paramSlug
        ? barberOnly.find((b) => b.slug === paramSlug)
        : null;
      if (match) {
        setSelectedSlug(match.slug);
      } else if (barberOnly.length > 0) {
        setSelectedSlug((prev) =>
          barberOnly.some((b) => b.slug === prev) ? prev : barberOnly[0].slug,
        );
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const barberBusinesses = allBusinesses.filter((b) =>
    isBarberOrSalonCategory(b.category),
  );
  const hasRestaurantBusinesses = allBusinesses.some(
    (b) => !isBarberOrSalonCategory(b.category),
  );
  const currentBarber =
    barberBusinesses.find((b) => b.slug === selectedSlug) ??
    barberBusinesses[0] ??
    null;

  if (loading) {
    return (
      <div className="py-20 text-center" role="status">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#111318] border-r-transparent" />
        <p className="mt-3 text-[15px] font-semibold text-[#5C6068]">
          Loading Barber Queue Studio…
        </p>
      </div>
    );
  }

  if (!currentBarber) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-[#111318]/15 bg-[#FAF8F5] py-14 px-6 text-center shadow-sm space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#111318] text-[#F3E3B8]">
          <Scissors className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-[24px] font-black text-[#111318]">
          No Barber Shop Registered Yet
        </h1>
        <p className="text-[14px] text-[#5C6068] leading-relaxed">
          Launch your standalone Barber &amp; Salon Queue Studio — live chair
          timers, 1-tap +5/+10/+15m broadcasts, customer Token QR passes, and
          barber PINs with zero restaurant clutter.
        </p>
        <Link
          to="/setup?type=barber"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#111318] px-5 py-2.5 text-[14px] font-extrabold text-[#F3E3B8] hover:bg-[#1F232C]"
        >
          <Plus className="h-4 w-4" aria-hidden /> Register Barber Shop / Salon
        </Link>
      </div>
    );
  }

  return (
    <BarberOwnerWorkspace
      key={currentBarber.id}
      business={currentBarber}
      barberBusinesses={barberBusinesses}
      hasRestaurantBusinesses={hasRestaurantBusinesses}
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
