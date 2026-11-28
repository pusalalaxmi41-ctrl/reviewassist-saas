import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Phone,
  Plus,
  Printer,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { businessRepository } from '../services/storage';
import type {
  CateringDishCategory,
  CateringOrder,
  CateringServiceMode,
  PublicCateringPortalPayload,
} from '../types/catering';
import {
  buildCateringWhatsAppQuoteLink,
  calculateCateringPricingBreakdown,
  CATERING_DISH_CATEGORY_LABELS,
  CATERING_OCCASION_PRESETS,
  formatCateringRupees,
  getCateringPortalUrl,
  normalizeCateringPhone,
} from '../utils/cateringValidation';

function getFutureIsoDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, daysAhead));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function CustomerCateringHubPage() {
  const { businessSlug = '' } = useParams<{ businessSlug: string }>();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';

  const [loading, setLoading] = useState(true);
  const [portal, setPortal] = useState<PublicCateringPortalPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<CateringOrder | null>(
    null,
  );

  // Step 1: Event Logistics & Hall Slot
  const [occasionType, setOccasionType] = useState<string>(
    CATERING_OCCASION_PRESETS[0],
  );
  const [eventDate, setEventDate] = useState<string>(() => getFutureIsoDate(3));
  const [deliveryTime, setDeliveryTime] = useState<string>('12:30 PM');
  const [serviceMode, setServiceMode] =
    useState<CateringServiceMode>('full_service');
  const [serviceZone, setServiceZone] = useState<string>('City Limits');
  const [venueAddress, setVenueAddress] = useState<string>('');
  const [usesBanquetHall, setUsesBanquetHall] = useState<boolean>(false);
  const [hallSlot, setHallSlot] = useState<string>('');
  const [waitersRequested, setWaitersRequested] = useState<number>(4);
  const [onsiteChefRequested, setOnsiteChefRequested] =
    useState<boolean>(false);

  // Step 2: Mixed Veg/Non-Veg Headcount, Package & Dish Pickers, Bulk Trays
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  );
  const [vegPlates, setVegPlates] = useState<number>(80);
  const [nonVegPlates, setNonVegPlates] = useState<number>(40);
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([]);
  const [bulkQuantities, setBulkQuantities] = useState<Record<string, number>>(
    {},
  );

  // Step 3: Hall Add-Ons & Guest Details
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [chefNotes, setChefNotes] = useState<string>('');

  useEffect(() => {
    let active = true;
    async function loadPortal() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await businessRepository.getPublicCateringPortal(
          businessSlug,
        );
        if (!active) return;
        setPortal(data);
        if (data) {
          const minDaysAhead = Math.max(
            1,
            Math.ceil((data.config.minAdvanceHours || 24) / 24),
          );
          setEventDate(getFutureIsoDate(minDaysAhead + 1));
          if (data.config.serviceZones.length > 0) {
            setServiceZone(data.config.serviceZones[0]);
          }
          if (data.config.hallSlots.length > 0) {
            setHallSlot(data.config.hallSlots[0]);
          }
          if (data.packages.length > 0) {
            const firstPkg = data.packages[0];
            setSelectedPackageId(firstPkg.id);
            const totalDefault = Math.max(data.config.minHeadcount, 100);
            const defaultVeg = Math.round(totalDefault * 0.6);
            setVegPlates(defaultVeg);
            setNonVegPlates(totalDefault - defaultVeg);

            // Pre-select default dishes respecting slot maxSelect
            const autoSelected: string[] = [];
            for (const rule of firstPkg.slotRules) {
              const matching = data.dishes
                .filter(
                  (d) => d.availableInPackages && d.category === rule.category,
                )
                .slice(0, rule.maxSelect);
              for (const m of matching) autoSelected.push(m.id);
            }
            setSelectedDishIds(autoSelected);
          }
        }
      } catch (err) {
        if (!active) return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Unable to load catering portal.',
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadPortal();
    return () => {
      active = false;
    };
  }, [businessSlug]);

  const config = portal?.config ?? null;
  const accentHex = config?.primaryAccentHex || '#D4AF37';
  const obsidianHex = config?.secondarySurfaceHex || '#0F1115';

  const minAllowedDateIso = useMemo(() => {
    const minDays = Math.max(
      1,
      Math.ceil((config?.minAdvanceHours ?? 24) / 24),
    );
    return getFutureIsoDate(minDays);
  }, [config?.minAdvanceHours]);

  const selectedPackage = useMemo(
    () =>
      portal?.packages.find((p) => p.id === selectedPackageId) ?? null,
    [portal?.packages, selectedPackageId],
  );

  const bookedSlotsOnSelectedDate = useMemo(() => {
    if (!portal) return new Set<string>();
    return new Set(
      portal.bookedHallSlots
        .filter((s) => s.eventDate === eventDate)
        .map((s) => s.hallSlot.toLowerCase()),
    );
  }, [portal, eventDate]);

  const bulkTotalPaise = useMemo(() => {
    if (!portal) return 0;
    let sum = 0;
    for (const dish of portal.dishes) {
      const qty = bulkQuantities[dish.id] || 0;
      if (qty > 0) {
        sum += Math.round(qty * dish.bulkUnitPricePaise);
      }
    }
    return sum;
  }, [portal, bulkQuantities]);

  const hallAddonsTotalPaise = useMemo(() => {
    if (!config) return 0;
    const set = new Set(selectedAddonIds);
    return config.hallAddonsCatalog
      .filter((a) => a.enabled && set.has(a.id))
      .reduce((s, a) => s + a.pricePaise, 0);
  }, [config, selectedAddonIds]);

  const livePricing = useMemo(() => {
    if (!config) {
      return calculateCateringPricingBreakdown({
        vegPlates: 0,
        vegRatePaise: 0,
        nonVegPlates: 0,
        nonVegRatePaise: 0,
        bulkItemsTotalPaise: 0,
        hallAddonsTotalPaise: 0,
        serviceMode: 'self_pickup',
        serviceRates: {
          waiterPerStaffPaise: 0,
          chefOnsitePaise: 0,
          transportPaise: 0,
          setupTeardownPaise: 0,
          equipmentRentalPaise: 0,
        },
      });
    }
    return calculateCateringPricingBreakdown({
      vegPlates: selectedPackage ? vegPlates : 0,
      vegRatePaise: selectedPackage?.vegPricePaise ?? 0,
      nonVegPlates: selectedPackage ? nonVegPlates : 0,
      nonVegRatePaise: selectedPackage?.nonVegPricePaise ?? 0,
      bulkItemsTotalPaise: bulkTotalPaise,
      hallAddonsTotalPaise,
      serviceMode,
      serviceRates: config.serviceRatesJson,
      waitersRequested:
        serviceMode === 'full_service' ? waitersRequested : undefined,
      onsiteChefRequested:
        serviceMode === 'full_service' ? onsiteChefRequested : false,
      gstRatePercent: 5,
    });
  }, [
    config,
    selectedPackage,
    vegPlates,
    nonVegPlates,
    bulkTotalPaise,
    hallAddonsTotalPaise,
    serviceMode,
    waitersRequested,
    onsiteChefRequested,
  ]);

  const validationIssue = useMemo((): string | null => {
    if (!config) return null;
    if (!eventDate) return 'Select your event date.';
    if (config.blackoutDates.includes(eventDate)) {
      return `Date ${eventDate} is blacked out / fully booked for kitchen prep.`;
    }
    if (eventDate < minAllowedDateIso) {
      return `Online bookings require at least ${config.minAdvanceHours}h advance notice (earliest: ${minAllowedDateIso}).`;
    }
    const totalPlates = selectedPackage ? vegPlates + nonVegPlates : 0;
    const hasBulk = Object.values(bulkQuantities).some((q) => q > 0);
    if (!selectedPackage && !hasBulk) {
      return 'Select a Catering Package or at least one Bulk À La Carte Tray.';
    }
    if (selectedPackage && totalPlates < config.minHeadcount) {
      return `Minimum headcount is ${config.minHeadcount} guests (currently ${totalPlates}).`;
    }
    if (totalPlates > config.maxCapacityPerEvent) {
      return `Maximum single-event capacity is ${config.maxCapacityPerEvent} guests.`;
    }
    if (usesBanquetHall) {
      if (!hallSlot) return 'Select a Banquet Hall time slot.';
      if (bookedSlotsOnSelectedDate.has(hallSlot.toLowerCase())) {
        return `Banquet Hall "${hallSlot}" on ${eventDate} is already booked.`;
      }
    }
    return null;
  }, [
    config,
    eventDate,
    minAllowedDateIso,
    selectedPackage,
    vegPlates,
    nonVegPlates,
    bulkQuantities,
    usesBanquetHall,
    hallSlot,
    bookedSlotsOnSelectedDate,
  ]);

  function handleSelectPackage(pkgId: string | null) {
    setSelectedPackageId(pkgId);
    if (!pkgId || !portal) return;
    const pkg = portal.packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const nextSelected: string[] = [];
    for (const rule of pkg.slotRules) {
      const existingInCat = selectedDishIds.filter((id) => {
        const d = portal.dishes.find((x) => x.id === id);
        return d?.category === rule.category;
      });
      if (existingInCat.length > 0) {
        nextSelected.push(...existingInCat.slice(0, rule.maxSelect));
      } else {
        const defaults = portal.dishes
          .filter((d) => d.availableInPackages && d.category === rule.category)
          .slice(0, rule.maxSelect)
          .map((d) => d.id);
        nextSelected.push(...defaults);
      }
    }
    setSelectedDishIds(nextSelected);
  }

  function togglePackageDish(
    dishId: string,
    category: CateringDishCategory,
    maxSelect: number,
  ) {
    if (!portal) return;
    setSelectedDishIds((prev) => {
      if (prev.includes(dishId)) {
        return prev.filter((id) => id !== dishId);
      }
      const inCat = prev.filter((id) => {
        const d = portal.dishes.find((x) => x.id === id);
        return d?.category === category;
      });
      if (inCat.length >= maxSelect) {
        // Replace oldest pick in that slot so interaction feels effortless
        const oldest = inCat[0];
        return [...prev.filter((id) => id !== oldest), dishId];
      }
      return [...prev, dishId];
    });
  }

  function adjustBulkQty(dishId: string, delta: number) {
    setBulkQuantities((prev) => {
      const next = Math.max(0, (prev[dishId] || 0) + delta);
      return { ...prev, [dishId]: next };
    });
  }

  function toggleHallAddon(addonId: string) {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId],
    );
  }

  async function handleSubmitQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!portal || !config) return;
    setErrorMsg(null);

    if (validationIssue) {
      setErrorMsg(validationIssue);
      return;
    }
    if (customerName.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (normalizeCateringPhone(customerPhone).length < 10) {
      setErrorMsg('Please enter a valid 10-digit WhatsApp / mobile number.');
      return;
    }

    setSubmitting(true);
    try {
      const bulkItems = Object.entries(bulkQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([dishId, quantity]) => ({ dishId, quantity }));

      const created = await businessRepository.submitCateringOrder({
        businessSlug: portal.business.slug,
        intakeChannel: isEmbed ? 'website_embed' : 'online_link',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        occasionType,
        eventDate,
        deliveryTime,
        serviceMode,
        serviceZone,
        venueAddress: usesBanquetHall
          ? `${config.hallName} (${hallSlot})`
          : venueAddress.trim() || null,
        usesBanquetHall,
        hallSlot: usesBanquetHall ? hallSlot : null,
        packageId: selectedPackage?.id ?? null,
        vegPlates: selectedPackage ? vegPlates : 0,
        nonVegPlates: selectedPackage ? nonVegPlates : 0,
        selectedDishIds: selectedPackage ? selectedDishIds : [],
        bulkItems,
        selectedHallAddonIds: selectedAddonIds,
        waitersRequested:
          serviceMode === 'full_service' ? waitersRequested : undefined,
        onsiteChefRequested:
          serviceMode === 'full_service' ? onsiteChefRequested : false,
        gstRatePercent: 5,
        chefNotes: chefNotes.trim() || null,
      });
      setSubmittedOrder(created);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not submit quote request.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: '#FBF9F5' }}
      >
        <div className="text-center space-y-3">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center animate-pulse"
            style={{ backgroundColor: obsidianHex, color: accentHex }}
          >
            <ChefHat className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-stone-600">
            Loading Royal Banquet & Catering Menu Configurator...
          </p>
        </div>
      </div>
    );
  }

  if (!portal || !config) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: '#FBF9F5' }}
      >
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-sm">
          <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-stone-900 mb-1">
            Catering Portal Unavailable
          </h1>
          <p className="text-sm text-stone-600">
            {errorMsg ||
              'This catering & banquet venue was not found or is currently offline.'}
          </p>
        </div>
      </div>
    );
  }

  // Confirmation & Instant Shareable WhatsApp Quote View
  if (submittedOrder) {
    const totalGuests =
      submittedOrder.vegPlates +
      submittedOrder.nonVegPlates +
      submittedOrder.extraPlatesAdded;
    const waShare = buildCateringWhatsAppQuoteLink({
      phone: submittedOrder.customerPhone,
      template: config.whatsappQuoteTemplate,
      customerName: submittedOrder.customerName,
      orderCode: submittedOrder.orderCode,
      eventDate: submittedOrder.eventDate,
      totalPlates: totalGuests,
      totalAmountPaise: submittedOrder.totalAmountPaise,
      advanceAmountPaise: submittedOrder.stage1AdvancePaise,
      portalUrl: getCateringPortalUrl(portal.business.slug),
    });

    return (
      <div
        className="min-h-screen py-8 px-4"
        style={{ backgroundColor: '#FBF9F5' }}
      >
        <div className="max-w-2xl mx-auto space-y-6">
          <div
            className="rounded-3xl p-6 sm:p-8 text-white shadow-xl"
            style={{ backgroundColor: obsidianHex }}
          >
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{ backgroundColor: accentHex, color: '#0F1115' }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Event Quote Generated
              </span>
              <span className="font-mono text-sm text-stone-300">
                Ref: <strong className="text-white">{submittedOrder.orderCode}</strong>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              {portal.business.name}
            </h1>
            <p className="text-sm text-stone-300 mb-6">
              Thank you, <strong>{submittedOrder.customerName}</strong>! Your
              custom catering & banquet quote for{' '}
              <strong>{submittedOrder.eventDate}</strong> ({submittedOrder.deliveryTime}) is ready.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/5 rounded-2xl p-4 border border-white/10">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-stone-400">
                  Guests
                </div>
                <div className="text-lg font-bold font-mono mt-0.5">
                  {totalGuests} Plates
                </div>
                <div className="text-[11px] text-stone-400">
                  {submittedOrder.vegPlates} Veg · {submittedOrder.nonVegPlates}{' '}
                  Non-Veg
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-stone-400">
                  Subtotal + 5% GST
                </div>
                <div className="text-lg font-bold font-mono mt-0.5">
                  {formatCateringRupees(submittedOrder.totalAmountPaise)}
                </div>
                <div className="text-[11px] text-stone-400">
                  GST: {formatCateringRupees(submittedOrder.gstPaise)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-stone-400">
                  30% Advance to Lock
                </div>
                <div
                  className="text-lg font-bold font-mono mt-0.5"
                  style={{ color: accentHex }}
                >
                  {formatCateringRupees(submittedOrder.stage1AdvancePaise)}
                </div>
                <div className="text-[11px] text-stone-400">Stage 1 Milestone</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-stone-400">
                  Service Mode
                </div>
                <div className="text-sm font-semibold mt-1 capitalize">
                  {submittedOrder.serviceMode.replace('_', ' ')}
                </div>
                {submittedOrder.usesBanquetHall && (
                  <div className="text-[11px] text-amber-300 truncate">
                    {submittedOrder.hallSlot}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900">
              3-Stage Milestone Payment Schedule
            </h2>
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-3.5">
                <div className="text-xs font-bold uppercase text-amber-900">
                  Stage 1 · Booking Advance (30%)
                </div>
                <div className="text-lg font-bold font-mono text-stone-900 mt-1">
                  {formatCateringRupees(submittedOrder.stage1AdvancePaise)}
                </div>
                <p className="text-xs text-stone-600 mt-0.5">
                  Locks event date & banquet slot
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3.5">
                <div className="text-xs font-bold uppercase text-stone-600">
                  Stage 2 · Pre-Event Release (50%)
                </div>
                <div className="text-lg font-bold font-mono text-stone-900 mt-1">
                  {formatCateringRupees(submittedOrder.stage2PreeventPaise)}
                </div>
                <p className="text-xs text-stone-600 mt-0.5">
                  24h before kitchen dispatch
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3.5">
                <div className="text-xs font-bold uppercase text-stone-600">
                  Stage 3 · Final Settlement (20%)
                </div>
                <div className="text-lg font-bold font-mono text-stone-900 mt-1">
                  {formatCateringRupees(submittedOrder.stage3BalancePaise)}
                </div>
                <p className="text-xs text-stone-600 mt-0.5">
                  Post-event + extra plates if any
                </p>
              </div>
            </div>

            {submittedOrder.selectedPackageDishes.length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Selected Menu Dishes ({submittedOrder.packageNameSnapshot})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {submittedOrder.selectedPackageDishes.map((d) => (
                    <span
                      key={d.dishId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-800"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          d.dietType === 'veg' ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      />
                      {d.dishName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-3">
              <a
                href={waShare.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm shadow-sm transition hover:opacity-95"
                style={{ backgroundColor: accentHex, color: '#0F1115' }}
              >
                <MessageCircle className="w-4 h-4" />
                Send / Save Quote on WhatsApp
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm border border-stone-300 text-stone-800 hover:bg-stone-50"
              >
                <Printer className="w-4 h-4" />
                Print Quote
              </button>
              <button
                type="button"
                onClick={() => setSubmittedOrder(null)}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm border border-stone-200 text-stone-600 hover:bg-stone-50"
              >
                Create Another Quote
              </button>
            </div>
          </div>

          {!isEmbed && (
            <div className="text-center">
              <Link
                to={`/r/${portal.business.slug}`}
                className="text-xs font-semibold text-stone-600 hover:text-stone-900 underline"
              >
                Attended an event by {portal.business.name}? Share a Google Review →
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  const bulkDishes = portal.dishes.filter((d) => d.availableBulkAlacarte);
  const enabledHallAddons = config.hallAddonsCatalog.filter((a) => a.enabled);

  return (
    <div
      className={`${isEmbed ? 'py-3 px-2' : 'min-h-screen pb-40'}`}
      style={{ backgroundColor: '#FBF9F5' }}
    >
      {/* Royal Obsidian Hero Header (compact in ?embed=1 iframe mode) */}
      <header
        className={`${
          isEmbed ? 'rounded-2xl mx-auto max-w-5xl mb-4 p-4' : 'py-8 px-4 mb-6'
        } text-white`}
        style={{ backgroundColor: obsidianHex }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            {config.brandLogoUrl ? (
              <img
                src={config.brandLogoUrl}
                alt={portal.business.name}
                className="w-12 h-12 rounded-2xl object-cover border border-white/15"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner"
                style={{ backgroundColor: accentHex, color: '#0F1115' }}
              >
                {portal.business.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: accentHex, color: '#0F1115' }}
                >
                  Instant Event & Catering Quote
                </span>
                <span className="text-xs text-stone-400">
                  {portal.business.city}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
                {portal.business.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-300">
            <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
              Min <strong>{config.minHeadcount}</strong> Guests
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
              <strong>{config.minAdvanceHours}h</strong> Advance Notice
            </span>
          </div>
        </div>
      </header>

      <form
        onSubmit={handleSubmitQuote}
        className="max-w-5xl mx-auto px-4 space-y-6"
      >
        {errorMsg && (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: EVENT DATE, SERVICE MODE & FUNCTION HALL SLOT */}
        <section className="bg-white rounded-3xl border border-stone-200/90 p-5 sm:p-7 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ backgroundColor: accentHex, color: '#0F1115' }}
            >
              1
            </span>
            <div>
              <h2 className="text-lg font-bold text-stone-900">
                Event Date, Service Mode & Banquet Slot
              </h2>
              <p className="text-xs text-stone-500">
                Real-time availability, blackout dates & advance notice rules enforced automatically
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Occasion Type
              </label>
              <select
                value={occasionType}
                onChange={(e) => setOccasionType(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {CATERING_OCCASION_PRESETS.map((occ) => (
                  <option key={occ} value={occ}>
                    {occ}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Event Date (Min {config.minAdvanceHours}h Notice)
              </label>
              <input
                type="date"
                value={eventDate}
                min={minAllowedDateIso}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm bg-white text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
              {config.blackoutDates.includes(eventDate) && (
                <p className="text-xs text-rose-600 font-medium mt-1">
                  This date is blacked out by the kitchen. Please pick another date.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                Buffet / Delivery Time
              </label>
              <select
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="08:00 AM">08:00 AM (Breakfast)</option>
                <option value="12:30 PM">12:30 PM (Lunch)</option>
                <option value="04:30 PM">04:30 PM (High Tea)</option>
                <option value="07:30 PM">07:30 PM (Evening Reception)</option>
                <option value="08:30 PM">08:30 PM (Gala Dinner)</option>
              </select>
            </div>
          </div>

          {/* 3 Service Modes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Choose Catering Service Mode
            </label>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'self_pickup' as const,
                  title: 'Self-Pickup',
                  desc: 'Collect packed insulated containers from kitchen (₹0 transport)',
                  icon: Package,
                },
                {
                  id: 'drop_off' as const,
                  title: 'Drop-Off Hot Boxes',
                  desc: `Doorstep delivery in SS hot boxes (+${formatCateringRupees(config.serviceRatesJson.transportPaise)})`,
                  icon: Truck,
                },
                {
                  id: 'full_service' as const,
                  title: 'Full Buffet & Waiters',
                  desc: 'Chafing dishes, buffet setup & uniformed hospitality staff',
                  icon: Users,
                },
              ].map((m) => {
                const Icon = m.icon;
                const active = serviceMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setServiceMode(m.id)}
                    className={`text-left rounded-2xl border p-3.5 transition ${
                      active
                        ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-500'
                        : 'border-stone-200 hover:border-stone-300 bg-stone-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                        <Icon className="w-4 h-4 text-amber-700" />
                        {m.title}
                      </span>
                      {active && (
                        <Check className="w-4 h-4 text-amber-700 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {m.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {serviceMode === 'full_service' && (
            <div className="grid sm:grid-cols-2 gap-4 rounded-2xl bg-stone-50 border border-stone-200 p-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Uniformed Serving Staff ({formatCateringRupees(config.serviceRatesJson.waiterPerStaffPaise)}/staff)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setWaitersRequested((w) => Math.max(1, w - 1))
                    }
                    className="w-9 h-9 rounded-lg border border-stone-300 bg-white flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-mono font-bold text-sm px-3">
                    {waitersRequested} Waiters
                  </span>
                  <button
                    type="button"
                    onClick={() => setWaitersRequested((w) => w + 1)}
                    className="w-9 h-9 rounded-lg border border-stone-300 bg-white flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm text-stone-800">
                  <input
                    type="checkbox"
                    checked={onsiteChefRequested}
                    onChange={(e) => setOnsiteChefRequested(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-600"
                  />
                  <span>
                    Add Live On-Site Ustad / Chef (+
                    {formatCateringRupees(
                      config.serviceRatesJson.chefOnsitePaise,
                    )}
                    )
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Banquet Hall Booking Toggle & Conflict-Checked Slots */}
          {config.banquetHallEnabled && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usesBanquetHall}
                    onChange={(e) => setUsesBanquetHall(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-600"
                  />
                  <span className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-700" />
                    Host Event at {config.hallName}
                  </span>
                </label>
                <span className="text-xs text-stone-600">
                  Live conflict-checked slots for {eventDate}
                </span>
              </div>

              {usesBanquetHall && (
                <div className="grid sm:grid-cols-3 gap-2.5 pt-1">
                  {config.hallSlots.map((slot) => {
                    const isBooked = bookedSlotsOnSelectedDate.has(
                      slot.toLowerCase(),
                    );
                    const isSelected = hallSlot === slot && !isBooked;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() => setHallSlot(slot)}
                        className={`rounded-xl border px-3.5 py-2.5 text-left transition ${
                          isBooked
                            ? 'border-rose-200 bg-rose-50/70 opacity-70 cursor-not-allowed'
                            : isSelected
                              ? 'border-amber-600 bg-white ring-2 ring-amber-500'
                              : 'border-stone-200 bg-white hover:border-amber-400'
                        }`}
                      >
                        <div className="text-xs font-bold text-stone-900">
                          {slot}
                        </div>
                        <div className="mt-1">
                          {isBooked ? (
                            <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                              Booked
                            </span>
                          ) : (
                            <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              Available
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!usesBanquetHall && serviceMode !== 'self_pickup' && (
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />
                  Service Zone
                </label>
                <select
                  value={serviceZone}
                  onChange={(e) => setServiceZone(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm bg-white text-stone-900"
                >
                  {config.serviceZones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Event Venue / Delivery Address
                </label>
                <input
                  type="text"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="Function hall / apartment / office landmark..."
                  className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm bg-white text-stone-900"
                />
              </div>
            </div>
          )}
        </section>

        {/* STEP 2: MIXED VEG & NON-VEG HEADCOUNT + PACKAGES + BULK TRAYS */}
        <section className="bg-white rounded-3xl border border-stone-200/90 p-5 sm:p-7 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span
                className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center"
                style={{ backgroundColor: accentHex, color: '#0F1115' }}
              >
                2
              </span>
              <div>
                <h2 className="text-lg font-bold text-stone-900">
                  Mixed Veg / Non-Veg Plates, Packages & Bulk Trays
                </h2>
                <p className="text-xs text-stone-500">
                  Split guests between Vegetarian & Non-Vegetarian plates or add bulk kg/trays
                </p>
              </div>
            </div>

            {selectedPackage && (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold font-mono bg-stone-900 text-amber-300">
                {vegPlates} Veg + {nonVegPlates} Non-Veg ={' '}
                {vegPlates + nonVegPlates} Guests
              </span>
            )}
          </div>

          {/* Tiered Packages */}
          <div className="grid md:grid-cols-3 gap-4">
            {portal.packages.map((pkg) => {
              const isSelected = selectedPackageId === pkg.id;
              return (
                <div
                  key={pkg.id}
                  onClick={() => handleSelectPackage(pkg.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isSelected ? accentHex : '#F5F5F4',
                        color: '#0F1115',
                      }}
                    >
                      {pkg.tierBadge}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-amber-700" />
                    )}
                  </div>
                  <h3 className="font-bold text-base text-stone-900">
                    {pkg.packageName}
                  </h3>
                  {pkg.description && (
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                      {pkg.description}
                    </p>
                  )}
                  <div className="mt-3 pt-3 border-t border-stone-200/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-emerald-800 font-bold">
                      ● Veg {formatCateringRupees(pkg.vegPricePaise)}
                    </span>
                    <span className="text-rose-800 font-bold">
                      ● Non-Veg {formatCateringRupees(pkg.nonVegPricePaise)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mixed Veg & Non-Veg Counters + Dish-Slot Pickers */}
          {selectedPackage && (
            <div className="space-y-5 pt-2">
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Veg Counter */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-950">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      Vegetarian Plates
                    </div>
                    <div className="text-xs font-mono text-emerald-800 mt-0.5">
                      {formatCateringRupees(selectedPackage.vegPricePaise)} / plate
                      {' · '}
                      {formatCateringRupees(
                        vegPlates * selectedPackage.vegPricePaise,
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setVegPlates((v) => Math.max(0, v - 10))
                      }
                      className="w-8 h-8 rounded-lg bg-white border border-emerald-300 font-bold text-emerald-900"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={config.maxCapacityPerEvent}
                      value={vegPlates}
                      onChange={(e) =>
                        setVegPlates(
                          Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        )
                      }
                      className="w-20 text-center rounded-lg border border-emerald-300 bg-white py-1.5 font-mono font-bold text-sm text-stone-900"
                    />
                    <button
                      type="button"
                      onClick={() => setVegPlates((v) => v + 10)}
                      className="w-8 h-8 rounded-lg bg-white border border-emerald-300 font-bold text-emerald-900"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Non-Veg Counter */}
                <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-rose-950">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                      Non-Vegetarian Plates
                    </div>
                    <div className="text-xs font-mono text-rose-800 mt-0.5">
                      {formatCateringRupees(selectedPackage.nonVegPricePaise)} /
                      plate ·{' '}
                      {formatCateringRupees(
                        nonVegPlates * selectedPackage.nonVegPricePaise,
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setNonVegPlates((v) => Math.max(0, v - 10))
                      }
                      className="w-8 h-8 rounded-lg bg-white border border-rose-300 font-bold text-rose-900"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={config.maxCapacityPerEvent}
                      value={nonVegPlates}
                      onChange={(e) =>
                        setNonVegPlates(
                          Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        )
                      }
                      className="w-20 text-center rounded-lg border border-rose-300 bg-white py-1.5 font-mono font-bold text-sm text-stone-900"
                    />
                    <button
                      type="button"
                      onClick={() => setNonVegPlates((v) => v + 10)}
                      className="w-8 h-8 rounded-lg bg-white border border-rose-300 font-bold text-rose-900"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Dish-Slot Pickers per Category Rule */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <UtensilsCrossed className="w-4 h-4 text-amber-700" />
                    Customize Dishes for {selectedPackage.packageName}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleSelectPackage(null)}
                    className="text-xs text-stone-500 hover:text-stone-800 underline"
                  >
                    Bulk Trays Only (Clear Package)
                  </button>
                </div>

                {selectedPackage.slotRules.map((rule) => {
                  const catDishes = portal.dishes.filter(
                    (d) =>
                      d.availableInPackages && d.category === rule.category,
                  );
                  if (catDishes.length === 0) return null;
                  const pickedCount = catDishes.filter((d) =>
                    selectedDishIds.includes(d.id),
                  ).length;

                  return (
                    <div
                      key={rule.category}
                      className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4"
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                          {rule.label ||
                            CATERING_DISH_CATEGORY_LABELS[rule.category]}
                        </span>
                        <span className="text-xs font-mono font-semibold text-amber-800">
                          Picked {pickedCount} / {rule.maxSelect}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {catDishes.map((dish) => {
                          const picked = selectedDishIds.includes(dish.id);
                          return (
                            <button
                              key={dish.id}
                              type="button"
                              onClick={() =>
                                togglePackageDish(
                                  dish.id,
                                  rule.category,
                                  rule.maxSelect,
                                )
                              }
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                                picked
                                  ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                                  : 'border-stone-200 bg-white text-stone-800 hover:border-stone-400'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  dish.dietType === 'veg'
                                    ? 'bg-emerald-500'
                                    : 'bg-rose-500'
                                }`}
                              />
                              {dish.dishName}
                              {picked && <Check className="w-3.5 h-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bulk À La Carte Trays (kg, litres, trays, pieces) */}
          {bulkDishes.length > 0 && (
            <div className="pt-3 border-t border-stone-200">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-stone-900">
                  Optional Bulk À La Carte Trays (By Weight / Tray)
                </h3>
                <p className="text-xs text-stone-500">
                  Add extra Biryanis by kg, starters by party tray, or live counter pieces
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {bulkDishes.map((dish) => {
                  const qty = bulkQuantities[dish.id] || 0;
                  return (
                    <div
                      key={dish.id}
                      className="rounded-2xl border border-stone-200 p-3.5 flex items-center justify-between gap-3 bg-white"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-stone-900 truncate flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              dish.dietType === 'veg'
                                ? 'bg-emerald-600'
                                : 'bg-rose-600'
                            }`}
                          />
                          {dish.dishName}
                        </div>
                        <div className="text-xs font-mono text-stone-500 mt-0.5">
                          {formatCateringRupees(dish.bulkUnitPricePaise)} /{' '}
                          {dish.bulkUnit}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => adjustBulkQty(dish.id, -1)}
                          className="w-7 h-7 rounded-lg border border-stone-300 flex items-center justify-center text-stone-700"
                        >
                          -
                        </button>
                        <span className="w-12 text-center font-mono text-xs font-bold">
                          {qty} {dish.bulkUnit}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustBulkQty(dish.id, 1)}
                          className="w-7 h-7 rounded-lg border border-stone-300 flex items-center justify-center text-stone-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* STEP 3: BANQUET ADD-ONS & GUEST CONTACT DETAILS */}
        <section className="bg-white rounded-3xl border border-stone-200/90 p-5 sm:p-7 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5">
            <span
              className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ backgroundColor: accentHex, color: '#0F1115' }}
            >
              3
            </span>
            <div>
              <h2 className="text-lg font-bold text-stone-900">
                Banquet Add-Ons & Host Details
              </h2>
              <p className="text-xs text-stone-500">
                Select hall facilities, live counters & enter WhatsApp number for your itemized quote
              </p>
            </div>
          </div>

          {enabledHallAddons.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {enabledHallAddons.map((addon) => {
                const picked = selectedAddonIds.includes(addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => toggleHallAddon(addon.id)}
                    className={`rounded-2xl border p-3.5 text-left transition flex items-start justify-between gap-2 ${
                      picked
                        ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-500'
                        : 'border-stone-200 bg-stone-50/40 hover:border-stone-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-stone-900">
                        {addon.label}
                      </div>
                      <div className="text-xs font-mono font-semibold text-amber-800 mt-1">
                        +{formatCateringRupees(addon.pricePaise)}
                      </div>
                    </div>
                    <Sparkles
                      className={`w-4 h-4 shrink-0 ${
                        picked ? 'text-amber-600' : 'text-stone-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Host / Organizer Full Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rajeshwar Rao"
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm bg-white text-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                <Phone className="w-3.5 h-3.5 inline mr-1" />
                10-Digit WhatsApp / Mobile Number *
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="98480 12345"
                className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm font-mono bg-white text-stone-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Kitchen / Dietary Instructions (Jain, Less Spicy, Separate Counters, etc.)
            </label>
            <textarea
              rows={2}
              value={chefNotes}
              onChange={(e) => setChefNotes(e.target.value)}
              placeholder="Optional notes directly for the Head Chef..."
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2 text-sm bg-white text-stone-900"
            />
          </div>
        </section>

        {/* STICKY LIVE COST BREAKDOWN BAR */}
        <div
          className={`${
            isEmbed
              ? 'rounded-3xl p-4 shadow-lg'
              : 'fixed bottom-0 inset-x-0 z-40 border-t border-white/15 px-4 py-3.5 shadow-2xl'
          } text-white`}
          style={{ backgroundColor: obsidianHex }}
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-5 flex-wrap">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-stone-400">
                  Per-Plate Avg
                </div>
                <div className="text-sm sm:text-base font-bold font-mono">
                  {formatCateringRupees(livePricing.perPlateAveragePaise)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-stone-400">
                  Subtotal + 5% GST
                </div>
                <div className="text-base sm:text-xl font-bold font-mono">
                  {formatCateringRupees(livePricing.totalAmountPaise)}
                </div>
              </div>
              <div className="hidden sm:block pl-4 border-l border-white/15">
                <div className="text-[11px] uppercase tracking-wider text-stone-400">
                  30% Booking Advance
                </div>
                <div
                  className="text-base font-bold font-mono"
                  style={{ color: accentHex }}
                >
                  {formatCateringRupees(livePricing.stage1AdvancePaise)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {validationIssue && (
                <span className="hidden md:inline-block text-xs text-amber-300 max-w-xs text-right">
                  {validationIssue}
                </span>
              )}
              <button
                type="submit"
                disabled={submitting || Boolean(validationIssue)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                style={{ backgroundColor: accentHex, color: '#0F1115' }}
              >
                <ShieldCheck className="w-4 h-4" />
                {submitting
                  ? 'Locking Quote...'
                  : 'Request / Lock Event Quote →'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
