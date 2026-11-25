import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  HeartPulse,
  Loader2,
  Package,
  Pill,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import type {
  ClinicVisitAndQueue,
  ClinicVisitType,
  PublicClinicHubPayload,
} from '../types/clinic';
import {
  businessRepository,
  PLACEHOLDER_GOOGLE_REVIEW_URL,
} from '../services/storage';
import { aiProvider } from '../services/ai';
import { loadBusinessQRSettings } from '../services/qr/qrGenerator';
import {
  formatRupeesCompactFromPaise,
  normalizeClinicPhone,
} from '../utils/clinicValidation';
import { copyText } from '../utils/clipboard';

interface StoredClinicPatient {
  phone: string;
  fullName: string;
}

function getClinicStorageKey(slug: string): string {
  return `vitaran_clinic_pass_v1_${slug.toLowerCase()}`;
}

function readStoredClinicPatient(slug: string): StoredClinicPatient | null {
  try {
    const raw = localStorage.getItem(getClinicStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredClinicPatient>;
    const phone = normalizeClinicPhone(parsed.phone);
    if (phone.length < 7) return null;
    return {
      phone,
      fullName: String(parsed.fullName ?? '').trim(),
    };
  } catch {
    return null;
  }
}

function writeStoredClinicPatient(
  slug: string,
  data: StoredClinicPatient | null,
): void {
  try {
    const key = getClinicStorageKey(slug);
    if (!data) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // Ignore private-browsing storage errors
  }
}

export default function CustomerClinicHubPage() {
  const { businessSlug = '' } = useParams<{ businessSlug: string }>();
  const cleanSlug = businessSlug.trim().toLowerCase();

  const initialStored = useMemo(
    () => (cleanSlug ? readStoredClinicPatient(cleanSlug) : null),
    [cleanSlug],
  );

  const [hub, setHub] = useState<PublicClinicHubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Patient Lookup & Check-In State
  const [activePhone, setActivePhone] = useState<string>(
    initialStored?.phone ?? '',
  );
  const [fullName, setFullName] = useState<string>(
    initialStored?.fullName ?? '',
  );
  const [phoneInput, setPhoneInput] = useState<string>(
    initialStored?.phone ?? '',
  );
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [visitType, setVisitType] = useState<ClinicVisitType>('walk_in');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [showCheckInFormEvenWithPass, setShowCheckInFormEvenWithPass] =
    useState(false);
  const [lookupInput, setLookupInput] = useState('');
  const [showLookupBox, setShowLookupBox] = useState(false);

  const [submittingToken, setSubmittingToken] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Health Pass Tabs & Rx Accordion
  const [passTab, setPassTab] = useState<'rx_visits' | 'packages_dues'>(
    'rx_visits',
  );
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [rxPhotoModalVisit, setRxPhotoModalVisit] =
    useState<ClinicVisitAndQueue | null>(null);

  // 1-Tap AI Google Review Composer
  const [reviewNote, setReviewNote] = useState('');
  const [draftingReview, setDraftingReview] = useState(false);
  const [generatedReview, setGeneratedReview] = useState('');
  const [copiedReview, setCopiedReview] = useState(false);

  const fetchHub = useCallback(
    async (phoneToLoad: string, isSilent = false) => {
      if (!cleanSlug) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!isSilent) setRefreshing(true);
      try {
        const res = await businessRepository.getPublicClinicHub(
          cleanSlug,
          phoneToLoad || null,
        );
        if (!res) {
          setNotFound(true);
          setHub(null);
        } else {
          setNotFound(false);
          setHub(res);
          if (res.doctors.length > 0) {
            setSelectedDoctorId((prev) =>
              prev && res.doctors.some((d) => d.id === prev)
                ? prev
                : res.doctors[0].id,
            );
          }
          if (res.patient) {
            setFullName((prev) => prev || res.patient!.fullName);
          }
          if (res.visitHistory.length > 0) {
            setExpandedVisitId((prev) => prev ?? res.visitHistory[0].id);
          }
        }
      } catch (err) {
        setErrorMsg((err as Error).message || 'Unable to load clinic portal.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cleanSlug],
  );

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      void fetchHub(activePhone, false);
    }, 0);
    const interval = window.setInterval(() => {
      void fetchHub(activePhone, true);
    }, 8_000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
    };
  }, [fetchHub, activePhone]);

  const qrLogo = useMemo(() => {
    if (!hub) return null;
    try {
      return loadBusinessQRSettings({
        id: hub.business.id,
        slug: hub.business.slug,
        name: hub.business.name,
        category: hub.business.category,
        city: hub.business.city,
        googleReviewUrl: hub.business.googleReviewUrl,
        createdAt: '',
      }).logoDataUrl;
    } catch {
      return null;
    }
  }, [hub]);

  const effectiveLogo = hub?.config.logoUrl || qrLogo || null;
  const accentColor = hub?.config.accentColor || '#10B981';

  async function handleClaimQueueToken(e: FormEvent) {
    e.preventDefault();
    if (!hub) return;
    setErrorMsg(null);
    setSuccessBanner(null);
    setSubmittingToken(true);

    try {
      const normalized = normalizeClinicPhone(phoneInput);
      const res = await businessRepository.checkinOrBookClinicToken({
        businessSlug: hub.business.slug,
        fullName,
        phone: normalized,
        doctorId: selectedDoctorId || hub.doctors[0]?.id || null,
        visitType,
        chiefComplaint,
        allergies: allergiesInput || null,
      });

      writeStoredClinicPatient(cleanSlug, {
        phone: normalized,
        fullName: fullName.trim(),
      });
      setActivePhone(normalized);
      setChiefComplaint('');
      setShowCheckInFormEvenWithPass(false);
      await fetchHub(normalized, false);
      setSuccessBanner(
        `Token ${res.tokenNumber} confirmed! ${
          res.patientsAhead === 0
            ? 'You are first in line.'
            : `${res.patientsAhead} patient(s) ahead (~${res.estimatedWaitMinutes} mins).`
        }`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmittingToken(false);
    }
  }

  async function handleLookupPass(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeClinicPhone(lookupInput);
    if (normalized.length < 7) {
      setErrorMsg('Please enter your 10-digit registered mobile number.');
      return;
    }
    setErrorMsg(null);
    setPhoneInput(normalized);
    setActivePhone(normalized);
    writeStoredClinicPatient(cleanSlug, {
      phone: normalized,
      fullName: fullName || '',
    });
    setShowLookupBox(false);
    await fetchHub(normalized, false);
  }

  async function handleDraftAiReview() {
    if (!hub) return;
    setDraftingReview(true);
    setErrorMsg(null);
    try {
      const latestCompleted = hub.visitHistory.find(
        (v) => v.status === 'completed',
      );
      const docMention = latestCompleted?.doctorName
        ? `Consultation with ${latestCompleted.doctorName} was clear, caring, and reassuring.`
        : 'The doctor explained everything patiently and reception was smooth.';
      const rawExperience = reviewNote.trim()
        ? `${docMention} ${reviewNote.trim()}`
        : `${docMention} Clean clinic, accurate live token wait times, and convenient digital prescription on my phone.`;

      const aiDraft = await aiProvider.generateReviewDraft({
        business: {
          slug: hub.business.slug,
          name: hub.business.name,
          category: hub.business.category,
        },
        experience: rawExperience,
        mode: 'text',
        attempt: 0,
      });
      setGeneratedReview(aiDraft.text);
      void businessRepository.trackEvent({
        businessId: hub.business.id,
        eventType: 'ai_generation',
      });
      void businessRepository.recordDraft({
        businessId: hub.business.id,
        originalInput: rawExperience,
        generatedReview: aiDraft.text,
        mode: 'text',
        sentiment: 'positive',
        ownerResponseDraft: null,
        responseStatus: 'pending',
        responseAttempt: 0,
      });
    } catch {
      setGeneratedReview(
        `Had a smooth and reassuring visit at ${hub.business.name} in ${hub.business.city}. Live queue token updates saved waiting time and receiving my digital prescription directly on my phone was super helpful!`,
      );
    } finally {
      setDraftingReview(false);
    }
  }

  async function handleCopyAndOpenGoogle() {
    if (!generatedReview || !hub) return;
    await copyText(generatedReview);
    setCopiedReview(true);
    setTimeout(() => setCopiedReview(false), 2500);
    if (
      hub.business.googleReviewUrl &&
      hub.business.googleReviewUrl !== PLACEHOLDER_GOOGLE_REVIEW_URL
    ) {
      window.open(hub.business.googleReviewUrl, '_blank', 'noopener,noreferrer');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="text-center space-y-2.5">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#0D9488]" />
          <p className="text-xs font-bold text-slate-600">
            Opening Clinic Digital Health Pass…
          </p>
        </div>
      </div>
    );
  }

  if (notFound || !hub) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="max-w-sm w-full rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm space-y-3">
          <Stethoscope className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="text-lg font-extrabold text-slate-900">
            Clinic Portal Unavailable
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            This clinic&apos;s digital queue and prescription pass is either awaiting activation or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  const activeVisit = hub.activeVisit;
  const patient = hub.patient;
  const completedVisits = hub.visitHistory.filter(
    (v) => v.status === 'completed',
  );
  const pkgTotal = patient?.packageSessionsTotal ?? 0;
  const pkgRemaining = patient?.packageSessionsRemaining ?? 0;
  const pkgUsed = Math.max(0, pkgTotal - pkgRemaining);
  const pkgPct =
    pkgTotal > 0 ? Math.min(100, Math.round((pkgRemaining / pkgTotal) * 100)) : 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 pb-12">
      <div className="mx-auto max-w-md px-4 pt-4 space-y-4">
        {/* ==================== DEEP OBSIDIAN (#0F1115) HEALTH PASS HEADER ==================== */}
        <header className="rounded-2xl bg-[#0F1115] p-5 text-white shadow-md space-y-4 border border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {effectiveLogo ? (
                <img
                  src={effectiveLogo}
                  alt={hub.business.name}
                  className="h-12 w-12 rounded-xl object-cover bg-white border border-white/15 shrink-0"
                />
              ) : (
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[#0F1115] font-black"
                  style={{ backgroundColor: '#C8F135' }}
                >
                  <HeartPulse className="h-6 w-6" aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-md bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#C8F135]">
                    Digital Health Pass
                  </span>
                  <span className="text-[11px] text-slate-400 truncate">
                    · {hub.business.city}
                  </span>
                </div>
                <h1 className="mt-1 text-base font-extrabold leading-snug text-white truncate">
                  {hub.business.name}
                </h1>
                <p className="text-[11.5px] text-slate-400 line-clamp-1">
                  {hub.config.clinicTagline}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void fetchHub(activePhone, false)}
              className="rounded-xl border border-white/15 bg-white/5 p-2 text-slate-300 hover:bg-white/10 cursor-pointer shrink-0"
              aria-label="Refresh live queue status"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? 'animate-spin text-[#C8F135]' : ''}`}
              />
            </button>
          </div>

          {/* Returning Patient Identity Bar or Phone Lookup Trigger */}
          {patient ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white/6 border border-white/10 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="h-4 w-4 text-[#C8F135] shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-white">{patient.fullName}</span>{' '}
                  <span className="font-mono text-[11px] text-[#10B981] font-extrabold tabular-nums">
                    ({patient.patientCode})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLookupInput('');
                  setShowLookupBox((v) => !v);
                }}
                className="text-[11px] font-bold text-slate-300 hover:text-white underline shrink-0 cursor-pointer"
              >
                Switch
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white/6 border border-white/10 px-3.5 py-2 text-xs">
              <span className="text-slate-300">
                Visited before? Access past prescriptions:
              </span>
              <button
                type="button"
                onClick={() => setShowLookupBox((v) => !v)}
                className="inline-flex items-center gap-1 font-extrabold text-[#C8F135] hover:underline shrink-0 cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" /> Find My Rx
              </button>
            </div>
          )}

          {showLookupBox && (
            <form
              onSubmit={(e) => void handleLookupPass(e)}
              className="flex gap-2 pt-1"
            >
              <input
                type="tel"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                placeholder="Enter 10-digit mobile number"
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-mono text-white placeholder:text-slate-400 focus:border-[#C8F135] focus:outline-none tabular-nums"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#C8F135] px-3.5 py-2 text-xs font-black text-[#0F1115] cursor-pointer"
              >
                Load Pass
              </button>
            </form>
          )}
        </header>

        {/* Feedback Banners */}
        {successBanner && (
          <div
            role="status"
            className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              {successBanner}
            </span>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-900"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              {errorMsg}
            </span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ==================== 2. LIVE WAITING ROOM TRACKER CARD (WHEN TOKEN IS ACTIVE) ==================== */}
        {activeVisit ? (
          <section className="rounded-2xl bg-[#0F1115] p-5 text-white shadow-lg border border-emerald-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-300">
                <Clock className="h-3 w-3 text-[#C8F135]" /> Live OPD Queue Pass
              </span>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {patient?.patientCode}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                  Your Token
                </p>
                <p className="text-4xl font-black tracking-tight text-[#C8F135] tabular-nums mt-0.5">
                  Token {activeVisit.tokenNumber}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-200">
                  {activeVisit.doctorName ?? 'Duty Doctor'}
                  {activeVisit.cabinLabel ? ` • ${activeVisit.cabinLabel}` : ''}
                </p>
              </div>

              <div className="rounded-2xl bg-white/8 border border-white/10 px-4 py-3 text-right tabular-nums">
                <p className="text-xl font-black text-white">
                  {activeVisit.status === 'in_consultation'
                    ? 'NOW'
                    : `~${activeVisit.estimatedWaitMinutes}m`}
                </p>
                <p className="text-[11px] font-semibold text-emerald-300">
                  {activeVisit.status === 'in_consultation'
                    ? 'Doctor Ready'
                    : `${activeVisit.patientsAhead} Patient${
                        activeVisit.patientsAhead === 1 ? '' : 's'
                      } Ahead`}
                </p>
              </div>
            </div>

            {activeVisit.status === 'in_consultation' ? (
              <div className="rounded-xl bg-[#C8F135] px-4 py-3 text-[#0F1115] font-black text-xs flex items-center justify-between shadow-sm">
                <span>
                  ● IN CONSULTATION — Please enter{' '}
                  {activeVisit.cabinLabel || 'Consultation Cabin'}
                </span>
                <Stethoscope className="h-4 w-4 shrink-0" />
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-500/12 border border-emerald-400/25 px-3.5 py-2.5 text-xs text-emerald-200 flex items-center justify-between tabular-nums">
                <span>
                  {activeVisit.patientsAhead === 0
                    ? 'You are next in line — please stay near reception.'
                    : `~${activeVisit.estimatedWaitMinutes} mins estimated wait (updates live)`}
                </span>
                {activeVisit.status === 'vitals_done' && (
                  <span className="rounded bg-emerald-400/20 px-2 py-0.5 text-[10px] font-extrabold text-[#C8F135]">
                    Vitals Done ✓
                  </span>
                )}
              </div>
            )}
          </section>
        ) : (
          /* ==================== 1. LIVE RECEPTION TOKEN CHECK-IN ==================== */
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Check In for Live OPD Token
                </h2>
                <p className="text-xs text-slate-500">
                  Pick your doctor &amp; reason to track live wait time on your phone.
                </p>
              </div>
              {patient && !showCheckInFormEvenWithPass && completedVisits.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCheckInFormEvenWithPass(true)}
                  className="rounded-xl bg-[#0D9488] px-3 py-1.5 text-xs font-extrabold text-white cursor-pointer"
                >
                  + New Token
                </button>
              )}
            </div>

            {!hub.config.isQueueOpen ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold text-amber-900">
                Reception has temporarily paused online queue tokens. Please check with the front desk.
              </div>
            ) : (
              (!patient ||
                completedVisits.length === 0 ||
                showCheckInFormEvenWithPass) && (
                <form
                  onSubmit={(e) => void handleClaimQueueToken(e)}
                  className="space-y-4"
                >
                  {/* Doctor / Department Cards */}
                  {hub.doctors.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        1. Select Doctor / Department
                      </label>
                      <div className="space-y-2">
                        {hub.doctors
                          .filter((d) => d.isAvailable)
                          .map((doc) => {
                            const selected = selectedDoctorId === doc.id;
                            return (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() => setSelectedDoctorId(doc.id)}
                                className={`w-full rounded-xl border p-3 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                  selected
                                    ? 'border-[#0D9488] bg-teal-50/60 ring-1 ring-[#0D9488]'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="rounded bg-[#0F1115] px-1.5 py-0.5 text-[10px] font-extrabold text-[#C8F135] tabular-nums">
                                      {doc.cabinLabel}
                                    </span>
                                    <span className="text-[11px] font-bold text-[#0D9488] truncate">
                                      {doc.specialty}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs font-extrabold text-slate-900">
                                    {doc.doctorName}
                                  </p>
                                </div>
                                <div className="text-right shrink-0 tabular-nums">
                                  <p className="text-xs font-black text-slate-900">
                                    ~{doc.estimatedWaitMinutes}m wait
                                  </p>
                                  <p className="text-[10.5px] text-slate-500">
                                    {doc.waitingCount} in queue ·{' '}
                                    {formatRupeesCompactFromPaise(
                                      doc.consultationFeePaise,
                                    )}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Visit Reason Pills */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      2. Visit Type
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'walk_in', label: 'New Consult' },
                          { id: 'followup', label: 'Follow-Up' },
                          { id: 'package_session', label: 'Package Session' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setVisitType(opt.id)}
                          className={`rounded-xl border py-2 px-2 text-[11.5px] font-extrabold transition-colors cursor-pointer ${
                            visitType === opt.id
                              ? 'border-[#0F1115] bg-[#0F1115] text-[#C8F135]'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name, Phone, Chief Complaint */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold focus:border-[#0D9488] focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="98490 11223"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold tabular-nums focus:border-[#0D9488] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Reason for Visit / Symptoms
                    </label>
                    <input
                      type="text"
                      value={chiefComplaint}
                      onChange={(e) => setChiefComplaint(e.target.value)}
                      placeholder="e.g. Toothache, skin rash, back pain, fever"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>

                  {!patient?.allergies && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500">
                        Drug Allergies (Optional — shown to doctor)
                      </label>
                      <input
                        type="text"
                        value={allergiesInput}
                        onChange={(e) => setAllergiesInput(e.target.value)}
                        placeholder="e.g. Penicillin, Aspirin (optional)"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingToken}
                    style={{ backgroundColor: accentColor }}
                    className="w-full rounded-xl py-3 text-sm font-black text-white shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {submittingToken ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Issuing Token…
                      </>
                    ) : (
                      <span>Get Live Queue Token →</span>
                    )}
                  </button>
                </form>
              )
            )}
          </section>
        )}

        {/* ==================== 3. DIGITAL HEALTH PASS TABS (MY RX & VISITS | PACKAGES & DUES) ==================== */}
        {patient && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-4">
            {/* Patient Medical Safety & Recall Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-lg bg-[#0F1115] px-2.5 py-1 font-mono text-xs font-extrabold text-[#C8F135] tabular-nums">
                  {patient.patientCode}
                </span>
                {patient.bloodGroup && (
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-extrabold text-slate-700">
                    Blood: {patient.bloodGroup}
                  </span>
                )}
                {patient.allergies && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-700">
                    <AlertTriangle className="h-3 w-3" />
                    Allergy: {patient.allergies}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                {patient.totalVisits} total visit{patient.totalVisits === 1 ? '' : 's'}
              </span>
            </div>

            {/* Upcoming Follow-Up Recall Banner */}
            {patient.nextFollowupDate && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-700 shrink-0" />
                  <div>
                    <p className="font-extrabold text-amber-950 tabular-nums">
                      Next Follow-Up: {patient.nextFollowupDate}
                    </p>
                    {patient.followupReason && (
                      <p className="text-[11px] text-amber-800">
                        {patient.followupReason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2-Tab Switcher */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setPassTab('rx_visits')}
                className={`rounded-lg py-2 text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  passTab === 'rx_visits'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                <FileText className="h-3.5 w-3.5 text-[#0D9488]" />
                My Rx &amp; Visits ({completedVisits.length})
              </button>
              <button
                type="button"
                onClick={() => setPassTab('packages_dues')}
                className={`rounded-lg py-2 text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  passTab === 'packages_dues'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600'
                }`}
              >
                <Package className="h-3.5 w-3.5 text-[#0D9488]" />
                Packages &amp; Dues
              </button>
            </div>

            {/* Tab 1: My Rx & Visits */}
            {passTab === 'rx_visits' && (
              <div className="space-y-3">
                {completedVisits.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Your digital prescriptions and vitals will appear here right after your doctor completes the consultation.
                  </div>
                ) : (
                  completedVisits.map((visit) => {
                    const expanded = expandedVisitId === visit.id;
                    const v = visit.vitalsJson || {};
                    const hasVitals = Boolean(
                      v.bp || v.pulse || v.tempF || v.weightKg,
                    );
                    return (
                      <div
                        key={visit.id}
                        className="rounded-2xl border border-slate-200/90 bg-[#F8F9FA] overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedVisitId(expanded ? null : visit.id)
                          }
                          className="w-full px-4 py-3 text-left flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-extrabold text-slate-900">
                                {visit.doctorName ?? 'Clinic Consultation'}
                              </span>
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900">
                                <Check className="h-2.5 w-2.5" /> Doctor Approved Rx
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                              {visit.visitDate} · {visit.tokenNumber}
                              {visit.doctorSpecialty
                                ? ` · ${visit.doctorSpecialty}`
                                : ''}
                            </p>
                          </div>
                          {expanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                        </button>

                        {expanded && (
                          <div className="border-t border-slate-200/70 bg-white p-4 space-y-3">
                            {/* Recorded Vitals */}
                            {hasVitals && (
                              <div className="flex flex-wrap gap-1.5 tabular-nums">
                                {v.bp && (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                                    <Activity className="h-3 w-3 text-[#0D9488]" />
                                    BP: {v.bp}
                                  </span>
                                )}
                                {v.pulse && (
                                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                                    Pulse: {v.pulse} bpm
                                  </span>
                                )}
                                {v.tempF && (
                                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                                    Temp: {v.tempF}°F
                                  </span>
                                )}
                                {v.weightKg && (
                                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                                    Wt: {v.weightKg} kg
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Diagnosis */}
                            {visit.diagnosisNotes && (
                              <div className="rounded-xl bg-[#F8F9FA] border border-slate-200/70 p-3 text-xs text-slate-700">
                                <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                                  Doctor&apos;s Diagnosis &amp; Advice
                                </p>
                                <p className="font-medium text-slate-900">
                                  {visit.diagnosisNotes}
                                </p>
                              </div>
                            )}

                            {/* Medicine Schedule */}
                            {visit.prescriptionItems.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
                                  Prescribed Medicines ({visit.prescriptionItems.length})
                                </p>
                                {visit.prescriptionItems.map((med, i) => (
                                  <div
                                    key={`${visit.id}-m-${i}`}
                                    className="rounded-xl border border-slate-200/80 p-3 flex items-start justify-between gap-2"
                                  >
                                    <div className="space-y-0.5">
                                      <p className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                        <Pill className="h-3.5 w-3.5 text-[#0D9488] shrink-0" />
                                        {med.medicineName}
                                      </p>
                                      {med.instruction && (
                                        <p className="text-[11px] text-slate-500">
                                          {med.instruction}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right shrink-0 tabular-nums">
                                      <span className="inline-block rounded-lg bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-extrabold text-[#0D9488]">
                                        {med.dosage}
                                      </span>
                                      <p className="text-[10.5px] font-semibold text-slate-500 mt-0.5">
                                        For {med.days} day{med.days === 1 ? '' : 's'}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Uploaded Rx / Lab Photo */}
                            {visit.rxAttachmentUrl && (
                              <button
                                type="button"
                                onClick={() => setRxPhotoModalVisit(visit)}
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/70 py-2 text-xs font-extrabold text-[#0D9488] hover:bg-teal-100 cursor-pointer"
                              >
                                <Eye className="h-4 w-4" /> View Rx Photo / Lab Report
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab 2: Packages & Dues */}
            {passTab === 'packages_dues' && (
              <div className="space-y-3 tabular-nums">
                {patient.activePackageName ? (
                  <div className="rounded-2xl bg-[#0F1115] p-4 text-white space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#C8F135]">
                          Active Treatment Package
                        </p>
                        <h3 className="text-sm font-extrabold text-white mt-0.5">
                          {patient.activePackageName}
                        </h3>
                      </div>
                      <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-300">
                        {pkgRemaining} / {pkgTotal} left
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#C8F135] transition-all"
                          style={{ width: `${pkgPct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {pkgRemaining} of {pkgTotal} sessions remaining (
                        {pkgUsed} completed)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                    No multi-session treatment package active on your file.
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200/80 bg-[#F8F9FA] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500 flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 text-slate-400" />
                      Total Billed To Date
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatRupeesCompactFromPaise(patient.totalBilledPaise)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">
                      Amount Paid
                    </span>
                    <span className="font-bold text-emerald-700">
                      {formatRupeesCompactFromPaise(patient.amountPaidPaise)}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800">
                      Pending Installment Balance
                    </span>
                    <span
                      className={`text-sm font-black ${
                        patient.balanceDuePaise > 0
                          ? 'text-rose-600'
                          : 'text-emerald-700'
                      }`}
                    >
                      {patient.balanceDuePaise > 0
                        ? formatRupeesCompactFromPaise(patient.balanceDuePaise)
                        : '₹0 (Settled ✓)'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ==================== 4. 1-TAP AI GOOGLE REVIEW CARD (/r/:businessSlug) ==================== */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10.5px] font-extrabold text-amber-900">
                <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                30-Second Care Feedback
              </div>
              <h2 className="mt-1.5 text-sm font-extrabold text-slate-900">
                Happy with your care at {hub.business.name}?
              </h2>
              <p className="text-xs text-slate-500">
                Draft a natural Google review in 1 tap or use our full guided review assistant.
              </p>
            </div>
          </div>

          <input
            type="text"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Optional note (e.g. Painless root canal by Dr. Ananya)"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-[#0D9488] focus:bg-white focus:outline-none"
          />

          {generatedReview && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 space-y-2">
              <p className="text-xs text-slate-800 leading-relaxed">
                {generatedReview}
              </p>
              <button
                type="button"
                onClick={() => void handleCopyAndOpenGoogle()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F1115] py-2.5 text-xs font-extrabold text-[#C8F135] cursor-pointer"
              >
                {copiedReview ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    Copied! Opening Google Reviews…
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Review &amp; Post on Google →
                  </>
                )}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={draftingReview}
              onClick={() => void handleDraftAiReview()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0D9488] py-2.5 px-3 text-xs font-extrabold text-white hover:bg-[#0F766E] cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#C8F135]" />
              {draftingReview ? 'Drafting…' : '1-Tap AI Draft'}
            </button>
            <Link
              to={`/r/${hub.business.slug}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-extrabold text-slate-800 hover:bg-slate-100"
            >
              Full Review Flow <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        <footer className="pt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#0D9488]" />
          <span>Encrypted ClinicOS Patient Health Pass · Private to your clinic</span>
        </footer>
      </div>

      {/* Rx Photo Lightbox Modal */}
      {rxPhotoModalVisit && rxPhotoModalVisit.rxAttachmentUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setRxPhotoModalVisit(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full rounded-2xl bg-white p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-slate-900">
                Prescription / Lab Attachment ({rxPhotoModalVisit.visitDate})
              </p>
              <button
                type="button"
                onClick={() => setRxPhotoModalVisit(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={rxPhotoModalVisit.rxAttachmentUrl}
              alt="Prescription Attachment"
              className="max-h-[72vh] w-full rounded-xl object-contain bg-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
