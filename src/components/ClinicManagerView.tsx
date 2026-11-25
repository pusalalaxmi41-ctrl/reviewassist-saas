import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Award,
  BarChart3,
  BellRing,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  HeartPulse,
  IndianRupee,
  MessageCircle,
  Package,
  Palette,
  Pill,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AnalyticsEvent,
  Business,
  BusinessMetrics,
  CustomerDraftRecord,
} from '../types/business';
import type {
  ClinicDoctorLiveCard,
  ClinicOwnerDashboardPayload,
  ClinicPatient,
  ClinicPatientGender,
  ClinicPaymentMethod,
  ClinicPrescriptionItem,
  ClinicVisitAndQueue,
  ClinicVisitType,
} from '../types/clinic';
import { businessRepository } from '../services/storage';
import {
  addDaysToIsoDate,
  getTodayIsoDateKey,
} from '../utils/gymValidation';
import {
  CLINIC_DOSAGE_PRESETS,
  CLINIC_SPECIALTY_PRESETS,
  CLINIC_TREATMENT_PACKAGE_PRESETS,
  buildClinicRecallWhatsAppLink,
  buildClinicYoureNextWhatsAppLink,
  calculateDoctorCommissionPaise,
  formatRupeesCompactFromPaise,
  getClinicPortalUrl,
} from '../utils/clinicValidation';
import { loadBusinessQRSettings } from '../services/qr/qrGenerator';
import { QRPosterGenerator } from './dashboard/QRPosterGenerator';
import { CustomerDraftsView } from './dashboard/CustomerDraftsView';
import { AnalyticsView } from './dashboard/AnalyticsView';
import { GoogleUrlSettings } from './dashboard/GoogleUrlSettings';
import { BusinessCategorySettings } from './dashboard/BusinessCategorySettings';
import { AIConfigurationSettings } from './dashboard/AIConfigurationSettings';
import { BusinessKnowledgeSettings } from './dashboard/BusinessKnowledgeSettings';

type ClinicNavSection =
  | 'opd_queue'
  | 'patients_rx'
  | 'recalls_dues'
  | 'doctors_commissions'
  | 'packages_branding'
  | 'ai_reviews';

interface Props {
  business: Business;
  clinicBusinesses: Business[];
  hasOtherBusinesses?: boolean;
  onSelectBusiness: (slug: string) => void;
  onBusinessUpdated: (updated: Business) => void;
}

const CLINIC_ACCENT_PRESETS = [
  { hex: '#0D9488', label: 'Medical Teal' },
  { hex: '#10B981', label: 'Surgical Emerald' },
  { hex: '#0284C7', label: 'Diagnostic Sky' },
  { hex: '#0F766E', label: 'Deep Pine Care' },
];

export function ClinicManagerView({
  business,
  clinicBusinesses,
  hasOtherBusinesses = false,
  onSelectBusiness,
  onBusinessUpdated,
}: Props) {
  const [activeNav, setActiveNav] = useState<ClinicNavSection>('opd_queue');
  const [aiSubTab, setAiSubTab] = useState<
    'qr' | 'drafts' | 'analytics' | 'settings'
  >('qr');

  const [dashboard, setDashboard] =
    useState<ClinicOwnerDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState<BusinessMetrics>({
    qrScans: 0,
    feedbackSubmissions: 0,
    aiGenerations: 0,
    googleRedirectClicks: 0,
  });
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [drafts, setDrafts] = useState<CustomerDraftRecord[]>([]);

  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Quick Walk-In Modal State
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInAge, setWalkInAge] = useState('');
  const [walkInGender, setWalkInGender] = useState<ClinicPatientGender | ''>('');
  const [walkInBloodGroup, setWalkInBloodGroup] = useState('');
  const [walkInAllergies, setWalkInAllergies] = useState('');
  const [walkInDoctorId, setWalkInDoctorId] = useState('');
  const [walkInVisitType, setWalkInVisitType] =
    useState<ClinicVisitType>('walk_in');
  const [walkInComplaint, setWalkInComplaint] = useState('');
  const [savingWalkIn, setSavingWalkIn] = useState(false);

  // Quick Vitals Modal State
  const [vitalsTarget, setVitalsTarget] = useState<ClinicVisitAndQueue | null>(
    null,
  );
  const [vitalBp, setVitalBp] = useState('120/80');
  const [vitalPulse, setVitalPulse] = useState('76');
  const [vitalTemp, setVitalTemp] = useState('98.6');
  const [vitalWeight, setVitalWeight] = useState('');
  const [savingVitals, setSavingVitals] = useState(false);

  // Doctor Consultation & Digital Rx Drawer State
  const [rxTarget, setRxTarget] = useState<ClinicVisitAndQueue | null>(null);
  const [rxDiagnosis, setRxDiagnosis] = useState('');
  const [rxItems, setRxItems] = useState<ClinicPrescriptionItem[]>([
    {
      medicineName: '',
      dosage: '1-0-1 After Food',
      days: 5,
      instruction: '',
    },
  ]);
  const [rxPhotoUrl, setRxPhotoUrl] = useState('');
  const [rxFeeRupees, setRxFeeRupees] = useState('500');
  const [rxCollectedRupees, setRxCollectedRupees] = useState('500');
  const [rxPaymentMethod, setRxPaymentMethod] =
    useState<ClinicPaymentMethod>('upi');
  const [rxDeductPackage, setRxDeductPackage] = useState(false);
  const [rxFollowupDate, setRxFollowupDate] = useState('');
  const [rxFollowupReason, setRxFollowupReason] = useState('');
  const [completingRx, setCompletingRx] = useState(false);

  // Rx Photo Preview Modal
  const [previewRxVisit, setPreviewRxVisit] =
    useState<ClinicVisitAndQueue | null>(null);

  // Collect Balance Modal State
  const [collectTarget, setCollectTarget] = useState<ClinicPatient | null>(
    null,
  );
  const [collectRupees, setCollectRupees] = useState('');
  const [collectMethod, setCollectMethod] =
    useState<ClinicPaymentMethod>('upi');
  const [collectingBalance, setCollectingBalance] = useState(false);

  // Patient Directory Search
  const [patientSearch, setPatientSearch] = useState('');

  // Doctor & Cabin Form State
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [docName, setDocName] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('Dental & Implantology');
  const [docCabin, setDocCabin] = useState('Room 1');
  const [docFeeRupees, setDocFeeRupees] = useState('500');
  const [docAvgMins, setDocAvgMins] = useState('15');
  const [docCommPct, setDocCommPct] = useState('50');
  const [docAvailable, setDocAvailable] = useState(true);
  const [savingDoctor, setSavingDoctor] = useState(false);

  // Package Assignment Form State
  const [pkgPatientId, setPkgPatientId] = useState('');
  const [pkgName, setPkgName] = useState('10-Session Ortho Physio Pack');
  const [pkgSessions, setPkgSessions] = useState('10');
  const [pkgFeeRupees, setPkgFeeRupees] = useState('8500');
  const [pkgPaidRupees, setPkgPaidRupees] = useState('5000');
  const [pkgNextDate, setPkgNextDate] = useState('');
  const [pkgReason, setPkgReason] = useState('Next Physio Rehab Session');
  const [savingPackage, setSavingPackage] = useState(false);

  // Clinic Branding Config State
  const [brandTagline, setBrandTagline] = useState(
    'Multi-Specialty Care, Live OPD Queue & Digital Prescriptions',
  );
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandAccent, setBrandAccent] = useState('#0D9488');
  const [brandQueueOpen, setBrandQueueOpen] = useState(true);
  const [brandRecallDays, setBrandRecallDays] = useState(3);
  const [savingBranding, setSavingBranding] = useState(false);

  const qrSettingsLogo = useMemo(
    () => loadBusinessQRSettings(business).logoDataUrl,
    [business],
  );
  const portalUrl = getClinicPortalUrl(business.slug);
  const todayIso = getTodayIsoDateKey();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const loadData = useCallback(
    async (syncBranding = false) => {
      try {
        const [dash, m, evts, drfts] = await Promise.all([
          businessRepository.getClinicOwnerDashboard(business.id),
          businessRepository.getMetrics(business.id),
          businessRepository.getEvents(business.id),
          businessRepository.getDrafts(business.id),
        ]);
        setDashboard(dash);
        setMetrics(m);
        setEvents(evts);
        setDrafts(drfts);
        if (syncBranding) {
          setBrandTagline(dash.config.clinicTagline);
          setBrandLogoUrl(dash.config.logoUrl ?? '');
          setBrandAccent(dash.config.accentColor || '#0D9488');
          setBrandQueueOpen(dash.config.isQueueOpen);
          setBrandRecallDays(dash.config.recallWindowDays || 3);
          if (dash.doctors.length > 0 && !walkInDoctorId) {
            setWalkInDoctorId(dash.doctors[0].id);
          }
          if (dash.patients.length > 0 && !pkgPatientId) {
            setPkgPatientId(dash.patients[0].id);
          }
        }
      } catch (err) {
        setErrorMsg(
          (err as Error).message || 'Failed to load ClinicOS workspace.',
        );
      } finally {
        setLoading(false);
      }
    },
    [business.id, walkInDoctorId, pkgPatientId],
  );

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      void loadData(true);
    }, 0);
    const timer = window.setInterval(() => {
      void loadData(false);
    }, 10_000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(timer);
    };
  }, [loadData]);

  const doctors = useMemo(() => dashboard?.doctors ?? [], [dashboard?.doctors]);
  const activeQueue = useMemo(
    () => dashboard?.activeQueue ?? [],
    [dashboard?.activeQueue],
  );
  const recallPatients = useMemo(
    () => dashboard?.recallRadarPatients ?? [],
    [dashboard?.recallRadarPatients],
  );
  const balanceDuePatients = useMemo(
    () => dashboard?.balanceDuePatients ?? [],
    [dashboard?.balanceDuePatients],
  );
  const allPatients = useMemo(
    () => dashboard?.patients ?? [],
    [dashboard?.patients],
  );
  const recentRx = useMemo(
    () => dashboard?.recentPrescriptions ?? [],
    [dashboard?.recentPrescriptions],
  );
  const commissions = useMemo(
    () => dashboard?.doctorCommissionSummary ?? [],
    [dashboard?.doctorCommissionSummary],
  );

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return allPatients;
    return allPatients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.patientCode.toLowerCase().includes(q) ||
        (p.allergies ?? '').toLowerCase().includes(q) ||
        (p.activePackageName ?? '').toLowerCase().includes(q),
    );
  }, [allPatients, patientSearch]);

  const effectiveLogo =
    dashboard?.config.logoUrl || qrSettingsLogo || null;
  const accentHex = dashboard?.config.accentColor || '#0D9488';

  function openVitalsModal(visit: ClinicVisitAndQueue) {
    setVitalsTarget(visit);
    setVitalBp(visit.vitalsJson.bp || '120/80');
    setVitalPulse(visit.vitalsJson.pulse || '76');
    setVitalTemp(visit.vitalsJson.tempF || '98.6');
    setVitalWeight(visit.vitalsJson.weightKg || '');
  }

  function openConsultDrawer(visit: ClinicVisitAndQueue) {
    setRxTarget(visit);
    setRxDiagnosis(visit.diagnosisNotes ?? '');
    setRxItems(
      visit.prescriptionItems.length > 0
        ? visit.prescriptionItems
        : [
            {
              medicineName: 'Augmentin 625mg',
              dosage: '1-0-1 After Food',
              days: 5,
              instruction: 'Complete 5-day course',
            },
          ],
    );
    setRxPhotoUrl(visit.rxAttachmentUrl ?? '');
    const defaultFeeRupees = Math.round((visit.feeChargedPaise || 0) / 100);
    setRxFeeRupees(String(defaultFeeRupees));
    setRxCollectedRupees(String(defaultFeeRupees));
    const hasPkg = (visit.patientPackageRemaining ?? 0) > 0;
    setRxDeductPackage(
      visit.visitType === 'package_session' || (hasPkg && defaultFeeRupees === 0),
    );
    setRxPaymentMethod(
      visit.visitType === 'package_session' ? 'package_credit' : 'upi',
    );
    setRxFollowupDate(addDaysToIsoDate(todayIso, 3));
    setRxFollowupReason(
      hasPkg
        ? `Next ${visit.patientPackageName ?? 'Package'} Session`
        : '3-Day Post-Consult Review',
    );
  }

  async function handleAdjustDoctorDelay(
    doctor: ClinicDoctorLiveCard,
    deltaMinutes: number,
  ) {
    setBusyId(doctor.id);
    setErrorMsg(null);
    try {
      await businessRepository.adjustClinicDoctorDelay({
        businessId: business.id,
        doctorId: doctor.id,
        deltaMinutes,
      });
      await loadData(false);
      const label = deltaMinutes > 0 ? `+${deltaMinutes}m` : `${deltaMinutes}m`;
      showToast(`Updated ${doctor.doctorName} live wait time (${label}).`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddWalkIn(e: FormEvent) {
    e.preventDefault();
    setSavingWalkIn(true);
    setErrorMsg(null);
    try {
      const parsedAge = walkInAge.trim()
        ? Number.parseInt(walkInAge.trim(), 10)
        : null;
      const res = await businessRepository.checkinOrBookClinicToken(
        {
          businessSlug: business.slug,
          fullName: walkInName,
          phone: walkInPhone,
          doctorId: walkInDoctorId || doctors[0]?.id || null,
          visitType: walkInVisitType,
          chiefComplaint: walkInComplaint,
          age: Number.isFinite(parsedAge) ? parsedAge : null,
          gender: walkInGender || null,
          bloodGroup: walkInBloodGroup || null,
          allergies: walkInAllergies || null,
        },
        business.ownerId ? { actorOwnerId: business.ownerId } : undefined,
      );
      setWalkInOpen(false);
      setWalkInName('');
      setWalkInPhone('');
      setWalkInAge('');
      setWalkInGender('');
      setWalkInBloodGroup('');
      setWalkInAllergies('');
      setWalkInComplaint('');
      await loadData(false);
      showToast(
        `Issued Token ${res.tokenNumber} (${res.patientCode}) • ~${res.estimatedWaitMinutes}m wait.`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingWalkIn(false);
    }
  }

  async function handleSaveVitals(e: FormEvent) {
    e.preventDefault();
    if (!vitalsTarget) return;
    setSavingVitals(true);
    setErrorMsg(null);
    try {
      const nextStatus =
        vitalsTarget.status === 'waiting' ? 'vitals_done' : vitalsTarget.status;
      await businessRepository.updateClinicVisitVitalsAndStatus({
        businessId: business.id,
        visitId: vitalsTarget.id,
        status: nextStatus,
        vitalsJson: {
          bp: vitalBp,
          pulse: vitalPulse,
          tempF: vitalTemp,
          weightKg: vitalWeight,
        },
      });
      setVitalsTarget(null);
      await loadData(false);
      showToast(`Recorded vitals for ${vitalsTarget.tokenNumber}.`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingVitals(false);
    }
  }

  async function handleQuickStatus(
    visit: ClinicVisitAndQueue,
    status: 'in_consultation' | 'no_show',
  ) {
    setBusyId(visit.id);
    setErrorMsg(null);
    try {
      await businessRepository.updateClinicVisitVitalsAndStatus({
        businessId: business.id,
        visitId: visit.id,
        status,
      });
      await loadData(false);
      showToast(
        status === 'in_consultation'
          ? `Called ${visit.tokenNumber} (${visit.patientName ?? 'Patient'}) into ${visit.cabinLabel ?? 'consultation cabin'}.`
          : `Marked ${visit.tokenNumber} as No-Show.`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function handleRxPhotoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image (PNG, JPG, WebP) for the Rx or Lab photo.');
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setErrorMsg('Please upload an Rx/Lab image smaller than 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRxPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleBrandLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid clinic logo image.');
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setErrorMsg('Clinic logo must be under 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBrandLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleCompleteConsultation(e: FormEvent) {
    e.preventDefault();
    if (!rxTarget) return;
    setCompletingRx(true);
    setErrorMsg(null);
    try {
      const feePaise = Math.max(
        0,
        Math.round((Number.parseFloat(rxFeeRupees) || 0) * 100),
      );
      const collectedPaise = Math.max(
        0,
        Math.round((Number.parseFloat(rxCollectedRupees) || 0) * 100),
      );
      await businessRepository.completeClinicConsultationAndRx({
        businessId: business.id,
        visitId: rxTarget.id,
        diagnosisNotes: rxDiagnosis,
        prescriptionItems: rxItems,
        rxAttachmentUrl: rxPhotoUrl || null,
        feeChargedPaise: feePaise,
        amountCollectedPaise: collectedPaise,
        paymentMethod: rxPaymentMethod,
        deductPackageSession: rxDeductPackage,
        nextFollowupDate: rxFollowupDate || null,
        followupReason: rxFollowupReason || null,
      });
      const tokenLabel = rxTarget.tokenNumber;
      setRxTarget(null);
      await loadData(false);
      showToast(
        `Completed ${tokenLabel} & published Digital Rx to patient's Health Pass.`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setCompletingRx(false);
    }
  }

  async function handleSaveDoctor(e: FormEvent) {
    e.preventDefault();
    setSavingDoctor(true);
    setErrorMsg(null);
    try {
      const feePaise = Math.max(
        0,
        Math.round((Number.parseFloat(docFeeRupees) || 0) * 100),
      );
      await businessRepository.upsertClinicDoctor(business.id, {
        id: editingDoctorId ?? undefined,
        doctorName: docName,
        specialty: docSpecialty,
        cabinLabel: docCabin,
        consultationFeePaise: feePaise,
        avgConsultMinutes: Number.parseInt(docAvgMins, 10) || 15,
        commissionPercent: Number.parseFloat(docCommPct) || 50,
        isAvailable: docAvailable,
      });
      setEditingDoctorId(null);
      setDocName('');
      setDocCabin(`Room ${doctors.length + 2}`);
      await loadData(false);
      showToast('Saved doctor & consultation cabin profile.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingDoctor(false);
    }
  }

  async function handleSeedStarterDoctors() {
    setSavingDoctor(true);
    setErrorMsg(null);
    try {
      await businessRepository.upsertClinicDoctor(business.id, {
        doctorName: 'Dr. Ananya Sharma',
        specialty: 'Dental & Implantology',
        cabinLabel: 'Room 1',
        consultationFeePaise: 60000,
        avgConsultMinutes: 15,
        commissionPercent: 50,
        isAvailable: true,
      });
      await businessRepository.upsertClinicDoctor(business.id, {
        doctorName: 'Dr. Vikram Nair',
        specialty: 'Orthopedics & Physiotherapy',
        cabinLabel: 'Room 2',
        consultationFeePaise: 50000,
        avgConsultMinutes: 20,
        commissionPercent: 45,
        isAvailable: true,
      });
      await loadData(false);
      showToast('Seeded 2 starter doctors & consultation cabins.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingDoctor(false);
    }
  }

  async function handleAssignPackage(e: FormEvent) {
    e.preventDefault();
    if (!pkgPatientId) {
      setErrorMsg('Please select a patient from the directory first.');
      return;
    }
    setSavingPackage(true);
    setErrorMsg(null);
    try {
      const feePaise = Math.max(
        0,
        Math.round((Number.parseFloat(pkgFeeRupees) || 0) * 100),
      );
      const paidPaise = Math.max(
        0,
        Math.round((Number.parseFloat(pkgPaidRupees) || 0) * 100),
      );
      const updated = await businessRepository.assignClinicTreatmentPackage({
        businessId: business.id,
        patientId: pkgPatientId,
        packageName: pkgName,
        sessionsTotal: Number.parseInt(pkgSessions, 10) || 1,
        packageFeePaise: feePaise,
        amountPaidNowPaise: paidPaise,
        nextFollowupDate: pkgNextDate || null,
        followupReason: pkgReason || null,
      });
      await loadData(false);
      showToast(
        `Assigned "${updated.activePackageName}" (${updated.packageSessionsRemaining} sessions) to ${updated.fullName}.`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingPackage(false);
    }
  }

  async function handleCollectBalance(e: FormEvent) {
    e.preventDefault();
    if (!collectTarget) return;
    setCollectingBalance(true);
    setErrorMsg(null);
    try {
      const amountPaise = Math.max(
        0,
        Math.round((Number.parseFloat(collectRupees) || 0) * 100),
      );
      const updated = await businessRepository.collectClinicPatientBalance({
        businessId: business.id,
        patientId: collectTarget.id,
        amountCollectedPaise: amountPaise,
        paymentMethod: collectMethod,
      });
      setCollectTarget(null);
      await loadData(false);
      showToast(
        `Collected ${formatRupeesCompactFromPaise(amountPaise)} from ${updated.fullName}. Remaining due: ${formatRupeesCompactFromPaise(updated.balanceDuePaise)}.`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setCollectingBalance(false);
    }
  }

  async function handleSaveBranding(e: FormEvent) {
    e.preventDefault();
    setSavingBranding(true);
    setErrorMsg(null);
    try {
      await businessRepository.updateClinicBrandingConfig(business.id, {
        clinicTagline: brandTagline,
        logoUrl: brandLogoUrl || null,
        accentColor: brandAccent,
        isQueueOpen: brandQueueOpen,
        recallWindowDays: brandRecallDays,
      });
      await loadData(false);
      showToast('Saved white-label clinic branding & reception settings.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingBranding(false);
    }
  }

  function handleExportCommissionsCsv() {
    const header = [
      'Doctor Name',
      'Specialty',
      'Cabin',
      'Commission %',
      'Consults Today',
      'Gross Today (INR)',
      'Payout Today (INR)',
      'Consults This Month',
      'Gross Month (INR)',
      'Payout Month (INR)',
    ];
    const rows = commissions.map((c) => [
      `"${c.doctorName.replace(/"/g, '""')}"`,
      `"${c.specialty.replace(/"/g, '""')}"`,
      `"${c.cabinLabel.replace(/"/g, '""')}"`,
      c.commissionPercent.toFixed(2),
      String(c.consultationsToday),
      (c.grossFeesTodayPaise / 100).toFixed(2),
      (c.commissionTodayPaise / 100).toFixed(2),
      String(c.consultationsThisMonth),
      (c.grossFeesThisMonthPaise / 100).toFixed(2),
      (c.commissionThisMonthPaise / 100).toFixed(2),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${business.slug}-doctor-commissions-${todayIso}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const navItems: Array<{
    id: ClinicNavSection;
    label: string;
    shortLabel: string;
    Icon: typeof Stethoscope;
    badge?: number;
  }> = [
    {
      id: 'opd_queue',
      label: 'Live OPD & Queue',
      shortLabel: 'Live OPD',
      Icon: HeartPulse,
      badge: dashboard?.kpis.patientsInQueueNow || undefined,
    },
    {
      id: 'patients_rx',
      label: 'Patients & Rx History',
      shortLabel: 'Patients & Rx',
      Icon: FileText,
    },
    {
      id: 'recalls_dues',
      label: '3-Day Recalls & Dues',
      shortLabel: 'Recalls & Dues',
      Icon: BellRing,
      badge:
        (dashboard?.kpis.recallsDueCount ?? 0) + balanceDuePatients.length ||
        undefined,
    },
    {
      id: 'doctors_commissions',
      label: 'Doctors & Commissions',
      shortLabel: 'Doctors',
      Icon: Stethoscope,
    },
    {
      id: 'packages_branding',
      label: 'Packages & Branding',
      shortLabel: 'Packages',
      Icon: Package,
    },
    {
      id: 'ai_reviews',
      label: 'AI Reviews',
      shortLabel: 'AI Reviews',
      Icon: Sparkles,
    },
  ];

  // Live preview math inside Consultation Drawer
  const rxDoc = rxTarget?.doctorId
    ? doctors.find((d) => d.id === rxTarget.doctorId)
    : undefined;
  const rxFeePreviewPaise = Math.max(
    0,
    Math.round((Number.parseFloat(rxFeeRupees) || 0) * 100),
  );
  const rxCollectedPreviewPaise = Math.max(
    0,
    Math.round((Number.parseFloat(rxCollectedRupees) || 0) * 100),
  );
  const rxNewDuePreviewPaise = Math.max(
    0,
    rxFeePreviewPaise - rxCollectedPreviewPaise,
  );
  const rxCommissionPreviewPaise = rxDoc
    ? calculateDoctorCommissionPaise(rxFeePreviewPaise, rxDoc.commissionPercent)
    : 0;

  if (loading && !dashboard) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#F8F9FA]">
        <div className="text-center space-y-2">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#0D9488] border-r-transparent" />
          <p className="text-sm font-semibold text-slate-600">
            Loading ClinicOS Reception &amp; OPD Command Center…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col lg:flex-row bg-[#F8F9FA] text-slate-900">
      {/* ==================== DEEP OBSIDIAN (#0F1115) LEFT SIDEBAR ==================== */}
      <aside className="w-full lg:w-64 lg:shrink-0 bg-[#0F1115] text-white border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col justify-between">
        <div className="p-4 lg:p-5 space-y-5">
          {/* Clinic Brand Card */}
          <div className="flex items-center gap-3">
            {effectiveLogo ? (
              <img
                src={effectiveLogo}
                alt={business.name}
                className="h-11 w-11 rounded-xl object-cover border border-white/15 bg-white shrink-0"
              />
            ) : (
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#0F1115] font-black shadow-sm"
                style={{ backgroundColor: '#C8F135' }}
              >
                <Stethoscope className="h-5 w-5" aria-hidden />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-md bg-teal-500/20 border border-teal-400/30 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#C8F135]">
                  ClinicOS
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    dashboard?.config.isQueueOpen
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {dashboard?.config.isQueueOpen ? 'OPD Open' : 'Paused'}
                </span>
              </div>
              <h1 className="mt-1 truncate text-[15px] font-bold text-white">
                {business.name}
              </h1>
              <p className="truncate text-[11.5px] text-slate-400">
                {business.city}
              </p>
            </div>
          </div>

          {/* Multi-Clinic Switcher */}
          {clinicBusinesses.length > 1 && (
            <div>
              <label
                htmlFor="clinicSwitcher"
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1"
              >
                Active Clinic Branch
              </label>
              <select
                id="clinicSwitcher"
                value={business.slug}
                onChange={(e) => onSelectBusiness(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white focus:border-[#10B981] focus:outline-none"
              >
                {clinicBusinesses.map((b) => (
                  <option key={b.id} value={b.slug} className="text-slate-900">
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Desktop Vertical Navigation */}
          <nav
            aria-label="ClinicOS Sections"
            className="hidden lg:flex lg:flex-col lg:gap-1"
          >
            {navItems.map((item) => {
              const Icon = item.Icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#0D9488] text-white shadow-sm'
                      : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        active ? 'text-[#C8F135]' : 'text-slate-400'
                      }`}
                      aria-hidden
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums ${
                        active
                          ? 'bg-[#C8F135] text-[#0F1115]'
                          : 'bg-white/10 text-[#C8F135]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mobile Horizontal Pill Navigation */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.Icon;
              const active = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#0D9488] text-white'
                      : 'bg-white/8 text-slate-300'
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${active ? 'text-[#C8F135]' : ''}`}
                    aria-hidden
                  />
                  <span>{item.shortLabel}</span>
                  {item.badge !== undefined && (
                    <span className="rounded-full bg-[#C8F135] px-1.5 text-[10px] font-black text-[#0F1115] tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Bottom Patient Pass & Setup Links */}
        <div className="hidden lg:block border-t border-white/10 p-4 space-y-2.5">
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20 transition-colors"
          >
            <span className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[#C8F135]" aria-hidden />
              <span>Patient Health Pass</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          <div className="flex items-center justify-between gap-2 text-[11.5px] text-slate-400">
            <Link
              to="/setup?type=clinic"
              className="inline-flex items-center gap-1 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add Clinic
            </Link>
            {hasOtherBusinesses && (
              <Link
                to="/dashboard?view=restaurant"
                className="inline-flex items-center gap-1 hover:text-white"
              >
                <Building2 className="h-3.5 w-3.5" aria-hidden /> All Apps
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* ==================== CLINICAL CRISP (#F8F9FA) MAIN WORKSPACE ==================== */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Operational Action Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/80 bg-white p-4 sm:px-6 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                {navItems.find((n) => n.id === activeNav)?.label}
              </h2>
              {business.status !== 'active' && (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                  Pending Admin Approval (Owner Preview Active)
                </span>
              )}
            </div>
            <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5">
              {dashboard?.config.clinicTagline}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData(false)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              <span>Sync Live</span>
            </button>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 text-xs font-bold text-[#0D9488] hover:bg-teal-100/70"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span>Open Patient Pass</span>
            </a>
            <button
              type="button"
              onClick={() => {
                if (doctors.length > 0 && !walkInDoctorId) {
                  setWalkInDoctorId(doctors[0].id);
                }
                setWalkInOpen(true);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0F1115] px-4 text-xs font-extrabold text-[#C8F135] shadow-sm hover:bg-slate-800 cursor-pointer"
            >
              <UserPlus className="h-4 w-4 text-[#10B981]" aria-hidden />
              <span>+ Add Walk-In Patient</span>
            </button>
          </div>
        </div>

        {/* Feedback Banners */}
        {toast && (
          <div
            role="status"
            className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm font-semibold text-emerald-900"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              {toast}
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-emerald-700 hover:text-emerald-950"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs sm:text-sm font-semibold text-rose-900"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              {errorMsg}
            </span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-700 hover:text-rose-950"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ==================== 4 ICON-BADGED HERO KPI CARDS (tabular-nums) ==================== */}
        {activeNav !== 'ai_reviews' && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Patients in Queue / Today
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-[#0D9488]">
                  <Users className="h-4.5 w-4.5" aria-hidden />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                {dashboard?.kpis.patientsInQueueNow ?? 0}{' '}
                <span className="text-sm font-bold text-slate-400">
                  / {dashboard?.kpis.patientsTodayTotal ?? 0} today
                </span>
              </p>
              <p className="mt-1 text-xs font-medium text-emerald-700 tabular-nums">
                {dashboard?.kpis.completedTodayCount ?? 0} consultations completed
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Today&apos;s Revenue (₹)
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <IndianRupee className="h-4.5 w-4.5" aria-hidden />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                {formatRupeesCompactFromPaise(
                  dashboard?.kpis.todayRevenuePaise ?? 0,
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                OPD:{' '}
                <strong className="text-slate-700">
                  {formatRupeesCompactFromPaise(
                    dashboard?.kpis.todayConsultationRevenuePaise ?? 0,
                  )}
                </strong>{' '}
                · Procedures:{' '}
                <strong className="text-slate-700">
                  {formatRupeesCompactFromPaise(
                    dashboard?.kpis.todayProceduresRevenuePaise ?? 0,
                  )}
                </strong>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  3-Day Recalls &amp; Follow-Ups
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <CalendarClock className="h-4.5 w-4.5" aria-hidden />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                {dashboard?.kpis.recallsDueCount ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                Due within ≤ {dashboard?.config.recallWindowDays ?? 3} days or overdue
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Pending Installment Dues (₹)
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <Wallet className="h-4.5 w-4.5" aria-hidden />
                </span>
              </div>
              <p className="mt-3 text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                {formatRupeesCompactFromPaise(
                  dashboard?.kpis.pendingBalanceDuePaise ?? 0,
                )}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                Across {balanceDuePatients.length} active package / procedure files
              </p>
            </div>
          </div>
        )}

        {/* ==================== SECTION 1: LIVE OPD & QUEUE ==================== */}
        {activeNav === 'opd_queue' && (
          <div className="space-y-6">
            {/* Live Doctor Cabins & Precision Wait Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
                    Live Doctor Cabins &amp; Precision Wait Controls
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tap <code className="font-mono">-2m / +2m / +5m / +10m</code> to broadcast instant ETA updates to waiting patients&apos; phones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('doctors_commissions')}
                  className="text-xs font-bold text-[#0D9488] hover:underline cursor-pointer"
                >
                  Manage Cabins →
                </button>
              </div>

              {doctors.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
                  <Stethoscope className="mx-auto h-9 w-9 text-[#0D9488]" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      No Consultation Cabins Added Yet
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-0.5">
                      Add your doctors or seed a 2-cabin multi-specialty starter setup to start issuing live OPD tokens.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      disabled={savingDoctor}
                      onClick={() => void handleSeedStarterDoctors()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D9488] px-4 py-2 text-xs font-bold text-white hover:bg-[#0F766E] cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#C8F135]" />
                      Seed Starter Doctors (Dental + Ortho)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNav('doctors_commissions')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      + Add Custom Doctor
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {doctors.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-lg bg-[#0F1115] px-2 py-0.5 text-[11px] font-extrabold text-[#C8F135] tabular-nums">
                                {doc.cabinLabel}
                              </span>
                              <span className="text-xs font-semibold text-[#0D9488]">
                                {doc.specialty}
                              </span>
                            </div>
                            <h4 className="mt-1.5 text-[15px] font-extrabold text-slate-900">
                              {doc.doctorName}
                            </h4>
                          </div>
                          <span className="text-xs font-bold text-slate-500 tabular-nums">
                            {formatRupeesCompactFromPaise(
                              doc.consultationFeePaise,
                            )}
                          </span>
                        </div>

                        {/* Active Consultation Status Banner */}
                        {doc.inConsultationTokenNumber ? (
                          <div className="rounded-xl bg-[#0F1115] px-3.5 py-2.5 text-white flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#C8F135]">
                                ● IN CONSULTATION
                              </p>
                              <p className="truncate text-xs font-semibold text-white mt-0.5 tabular-nums">
                                {doc.inConsultationTokenNumber} ·{' '}
                                {doc.inConsultationPatientName}
                              </p>
                            </div>
                            <span className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-300 tabular-nums">
                              {doc.waitingCount} active
                            </span>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-[11px] font-bold text-emerald-700">
                                ● Cabin Available
                              </p>
                              <p className="text-[11.5px] text-slate-500 tabular-nums">
                                {doc.waitingCount} waiting · ~{doc.avgConsultMinutes}m/visit
                              </p>
                            </div>
                            <span className="text-xs font-extrabold text-slate-800 tabular-nums">
                              ~{doc.estimatedWaitMinutes}m ETA
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Precision Delay Controls */}
                      <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                        <div className="text-[11.5px] text-slate-500 tabular-nums">
                          New Token ETA:{' '}
                          <strong className="text-slate-900">
                            ~{doc.estimatedWaitMinutes}m
                          </strong>
                          {doc.extraDelayMinutes !== 0 && (
                            <span
                              className={`ml-1 font-bold ${
                                doc.extraDelayMinutes > 0
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              ({doc.extraDelayMinutes > 0 ? '+' : ''}
                              {doc.extraDelayMinutes}m)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {([-2, 2, 5, 10] as const).map((delta) => (
                            <button
                              key={delta}
                              type="button"
                              disabled={busyId === doc.id}
                              onClick={() =>
                                void handleAdjustDoctorDelay(doc, delta)
                              }
                              className={`rounded-lg border px-2 py-1 text-[11px] font-extrabold tabular-nums transition-colors cursor-pointer ${
                                delta < 0
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              {delta > 0 ? `+${delta}m` : `${delta}m`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Waiting Room Queue Table */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 px-5 py-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Live Waiting Room Queue ({activeQueue.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Record nurse vitals, send 1-tap WhatsApp turn alerts, or open the Doctor Consultation &amp; Digital Rx drawer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWalkInOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0D9488] px-3.5 py-2 text-xs font-extrabold text-white hover:bg-[#0F766E] cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  <span>+ Add Walk-In Patient</span>
                </button>
              </div>

              {activeQueue.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
                  <p className="text-sm font-bold text-slate-800">
                    Waiting Room Is Clear
                  </p>
                  <p className="text-xs text-slate-500">
                    Patients scanning your reception QR standee (`/r/{business.slug}/clinic`) appear here in real time.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-3">Token</th>
                        <th className="px-4 py-3">Patient &amp; Allergies</th>
                        <th className="px-4 py-3">Doctor / Complaint</th>
                        <th className="px-4 py-3">Vitals</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-5 py-3 text-right">1-Tap Clinical Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeQueue.map((visit) => {
                        const v = visit.vitalsJson || {};
                        const hasVitals = Boolean(
                          v.bp || v.tempF || v.pulse || v.weightKg,
                        );
                        const whatsAppNextUrl = buildClinicYoureNextWhatsAppLink({
                          phone: visit.patientPhone ?? '',
                          patientName: visit.patientName ?? 'Patient',
                          tokenNumber: visit.tokenNumber,
                          clinicName: business.name,
                          doctorName: visit.doctorName,
                          cabinLabel: visit.cabinLabel,
                          businessSlug: business.slug,
                        });

                        return (
                          <tr
                            key={visit.id}
                            className={`transition-colors ${
                              visit.status === 'in_consultation'
                                ? 'bg-emerald-50/50'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center rounded-xl bg-[#0F1115] px-3 py-1.5 text-sm font-black text-[#C8F135] tabular-nums">
                                {visit.tokenNumber}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-extrabold text-slate-900 text-[13px]">
                                  {visit.patientName ?? 'Walk-In Patient'}
                                </span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-600 tabular-nums">
                                  {visit.patientCode}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                                  {visit.patientPhone}
                                  {visit.patientAge ? ` · ${visit.patientAge}y` : ''}
                                </span>
                                {visit.patientAllergies && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10.5px] font-extrabold text-rose-700">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    Allergy: {visit.patientAllergies}
                                  </span>
                                )}
                                {(visit.patientPackageRemaining ?? 0) > 0 && (
                                  <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10.5px] font-bold text-[#0D9488] tabular-nums">
                                    Pack: {visit.patientPackageRemaining}/
                                    {visit.patientPackageTotal} left
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="font-bold text-slate-800">
                                {visit.doctorName ?? 'Any Available Doctor'}
                                {visit.cabinLabel && (
                                  <span className="ml-1.5 text-[11px] font-semibold text-[#0D9488]">
                                    ({visit.cabinLabel})
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11.5px] text-slate-500 max-w-xs truncate">
                                {visit.chiefComplaint || 'General consultation'}
                              </p>
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap">
                              {hasVitals ? (
                                <button
                                  type="button"
                                  onClick={() => openVitalsModal(visit)}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-bold text-emerald-900 tabular-nums hover:bg-emerald-100 cursor-pointer"
                                >
                                  <Activity className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>
                                    {v.bp ? `BP ${v.bp}` : ''}
                                    {v.bp && v.tempF ? ' • ' : ''}
                                    {v.tempF ? `${v.tempF}°F` : ''}
                                    {!v.bp && !v.tempF && v.pulse
                                      ? `${v.pulse} bpm`
                                      : ''}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  Not recorded
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap">
                              {visit.status === 'in_consultation' ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0F1115] px-2.5 py-1 text-[11px] font-extrabold text-[#C8F135]">
                                  ● IN CONSULTATION
                                </span>
                              ) : visit.status === 'vitals_done' ? (
                                <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-[#0D9488]">
                                  Vitals Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                                  Waiting
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openVitalsModal(visit)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  <Activity className="h-3.5 w-3.5 text-[#0D9488]" />
                                  Vitals
                                </button>

                                {visit.status !== 'in_consultation' && (
                                  <button
                                    type="button"
                                    disabled={busyId === visit.id}
                                    onClick={() =>
                                      void handleQuickStatus(
                                        visit,
                                        'in_consultation',
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[11.5px] font-bold text-[#0D9488] hover:bg-teal-100 cursor-pointer"
                                  >
                                    Call In
                                  </button>
                                )}

                                {visit.patientPhone && (
                                  <a
                                    href={whatsAppNextUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11.5px] font-bold text-emerald-800 hover:bg-emerald-100"
                                    title='Send WhatsApp "You&apos;re Next" ping'
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                    WhatsApp &ldquo;You&apos;re Next&rdquo;
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openConsultDrawer(visit)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#0D9488] px-3 py-1.5 text-[11.5px] font-extrabold text-white shadow-2xs hover:bg-[#0F766E] cursor-pointer"
                                >
                                  Consult &amp; Write Rx →
                                </button>

                                <button
                                  type="button"
                                  disabled={busyId === visit.id}
                                  onClick={() =>
                                    void handleQuickStatus(visit, 'no_show')
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-rose-600 hover:border-rose-200 cursor-pointer"
                                  title="Mark No-Show"
                                >
                                  No-Show
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Compact 3-Day Recall & Balance Due Radar Strip right below Live OPD */}
            {(recallPatients.length > 0 || balanceDuePatients.length > 0) && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-amber-600" />
                      3-Day Recall Radar ({recallPatients.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActiveNav('recalls_dues')}
                      className="text-xs font-bold text-[#0D9488] hover:underline cursor-pointer"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {recallPatients.slice(0, 4).map((pt) => {
                      const waUrl = buildClinicRecallWhatsAppLink({
                        phone: pt.phone,
                        patientName: pt.fullName,
                        clinicName: business.name,
                        followupDate: pt.nextFollowupDate,
                        followupReason: pt.followupReason,
                        balanceDuePaise: pt.balanceDuePaise,
                        businessSlug: business.slug,
                      });
                      return (
                        <div
                          key={pt.id}
                          className="py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {pt.fullName}{' '}
                              <span className="font-mono text-[10.5px] text-slate-400">
                                ({pt.patientCode})
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-500 truncate tabular-nums">
                              {pt.followupReason || 'Scheduled Review'} ·{' '}
                              <strong
                                className={
                                  pt.daysUntilFollowup < 0
                                    ? 'text-rose-600'
                                    : 'text-amber-700'
                                }
                              >
                                {pt.daysUntilFollowup < 0
                                  ? `${Math.abs(pt.daysUntilFollowup)}d overdue`
                                  : pt.daysUntilFollowup === 0
                                    ? 'Due Today'
                                    : `In ${pt.daysUntilFollowup}d`}
                              </strong>
                            </p>
                          </div>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Send WhatsApp Recall
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-rose-600" />
                      Pending Installment Dues ({balanceDuePatients.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setActiveNav('recalls_dues')}
                      className="text-xs font-bold text-[#0D9488] hover:underline cursor-pointer"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {balanceDuePatients.slice(0, 4).map((pt) => (
                      <div
                        key={pt.id}
                        className="py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {pt.fullName}{' '}
                            <span className="font-mono text-[10.5px] text-slate-400">
                              ({pt.patientCode})
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500 truncate tabular-nums">
                            {pt.activePackageName || 'Consultation / Procedure'} · Due{' '}
                            <strong className="text-rose-600">
                              {formatRupeesCompactFromPaise(pt.balanceDuePaise)}
                            </strong>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCollectTarget(pt);
                            setCollectRupees(
                              String(Math.round(pt.balanceDuePaise / 100)),
                            );
                          }}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-[#0F1115] px-3 py-1.5 text-[11px] font-extrabold text-[#C8F135] hover:bg-slate-800 cursor-pointer tabular-nums"
                        >
                          Collect {formatRupeesCompactFromPaise(pt.balanceDuePaise)} ✓
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== SECTION 2: PATIENTS & RX HISTORY ==================== */}
        {activeNav === 'patients_rx' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Master Patient Directory ({allPatients.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Allergy alerts, multi-session treatment packs, billing balances, and follow-up dates.
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search PT-001, name, phone, allergy..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#0D9488] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Allergies &amp; Blood</th>
                      <th className="px-4 py-3">Active Treatment Pack</th>
                      <th className="px-4 py-3">Next Follow-Up</th>
                      <th className="px-4 py-3">Balance Due</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredPatients.map((pt) => (
                      <tr key={pt.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">
                            {pt.fullName}{' '}
                            <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 tabular-nums">
                              {pt.patientCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                            {pt.phone}
                            {pt.age ? ` · ${pt.age}y` : ''}
                            {pt.gender ? ` · ${pt.gender}` : ''} · {pt.totalVisits}{' '}
                            visits
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {pt.allergies ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-700">
                              <AlertTriangle className="h-3 w-3" />
                              {pt.allergies}
                            </span>
                          ) : (
                            <span className="text-slate-400">None recorded</span>
                          )}
                          {pt.bloodGroup && (
                            <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-700">
                              {pt.bloodGroup}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums">
                          {pt.activePackageName ? (
                            <div>
                              <p className="font-bold text-slate-800">
                                {pt.activePackageName}
                              </p>
                              <p className="text-[11px] font-semibold text-[#0D9488]">
                                {pt.packageSessionsRemaining} of{' '}
                                {pt.packageSessionsTotal} sessions left
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums">
                          {pt.nextFollowupDate ? (
                            <div>
                              <p className="font-bold text-slate-800">
                                {pt.nextFollowupDate}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {pt.followupReason || 'Follow-up'}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-extrabold tabular-nums">
                          {pt.balanceDuePaise > 0 ? (
                            <span className="text-rose-600">
                              {formatRupeesCompactFromPaise(pt.balanceDuePaise)}
                            </span>
                          ) : (
                            <span className="text-emerald-600">Settled</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setPkgPatientId(pt.id);
                                setActiveNav('packages_branding');
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              + Assign Pack
                            </button>
                            {pt.balanceDuePaise > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCollectTarget(pt);
                                  setCollectRupees(
                                    String(Math.round(pt.balanceDuePaise / 100)),
                                  );
                                }}
                                className="rounded-lg bg-[#0D9488] px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-[#0F766E] cursor-pointer"
                              >
                                Collect ₹
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Digital Prescription (Rx) Vault */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Digital Prescription (Rx) &amp; Consultation Vault ({recentRx.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Every completed consultation automatically syncs to the patient&apos;s Digital Health Pass at `/r/{business.slug}/clinic`.
                </p>
              </div>

              {recentRx.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No completed prescriptions recorded yet.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {recentRx.map((rx) => (
                    <div
                      key={rx.id}
                      className="rounded-2xl border border-slate-200/80 bg-[#F8F9FA] p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-[#0F1115] px-2 py-0.5 text-[11px] font-extrabold text-[#C8F135] tabular-nums">
                              {rx.tokenNumber}
                            </span>
                            <span className="text-sm font-extrabold text-slate-900">
                              {rx.patientName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              ({rx.patientCode})
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11.5px] text-slate-500 tabular-nums">
                            {rx.doctorName ?? 'Doctor'} · {rx.visitDate} · Billed{' '}
                            {formatRupeesCompactFromPaise(rx.feeChargedPaise)}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[10.5px] font-extrabold text-emerald-900">
                          <Check className="h-3 w-3" /> Doctor Approved Rx
                        </span>
                      </div>

                      {rx.diagnosisNotes && (
                        <p className="rounded-xl bg-white border border-slate-200/70 px-3 py-2 text-xs text-slate-700">
                          <strong className="text-slate-900">Diagnosis:</strong>{' '}
                          {rx.diagnosisNotes}
                        </p>
                      )}

                      {rx.prescriptionItems.length > 0 && (
                        <div className="space-y-1.5">
                          {rx.prescriptionItems.map((med, idx) => (
                            <div
                              key={`${rx.id}-med-${idx}`}
                              className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs border border-slate-200/60"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <Pill className="h-3.5 w-3.5 text-[#0D9488]" />
                                  {med.medicineName}
                                </span>
                                {med.instruction && (
                                  <p className="text-[11px] text-slate-500">
                                    {med.instruction}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0 tabular-nums">
                                <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-[#0D9488]">
                                  {med.dosage}
                                </span>
                                <p className="text-[10.5px] text-slate-500 mt-0.5">
                                  {med.days} days
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {rx.rxAttachmentUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewRxVisit(rx)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-[#0D9488] hover:bg-teal-50 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Uploaded Rx / Lab Photo
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== SECTION 3: 3-DAY RECALLS & DUES RADAR ==================== */}
        {activeNav === 'recalls_dues' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-amber-600" />
                  3-Day Follow-Up &amp; Recall Radar ({recallPatients.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automatically surfaces post-op reviews, dental crown trials, and physio package sessions due within {dashboard?.config.recallWindowDays ?? 3} days.
                </p>
              </div>

              {recallPatients.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No patient recalls due in the next {dashboard?.config.recallWindowDays ?? 3} days.
                </div>
              ) : (
                <div className="space-y-3">
                  {recallPatients.map((pt) => {
                    const waUrl = buildClinicRecallWhatsAppLink({
                      phone: pt.phone,
                      patientName: pt.fullName,
                      clinicName: business.name,
                      followupDate: pt.nextFollowupDate,
                      followupReason: pt.followupReason,
                      balanceDuePaise: pt.balanceDuePaise,
                      businessSlug: business.slug,
                    });
                    return (
                      <div
                        key={pt.id}
                        className="rounded-2xl border border-slate-200/80 bg-[#F8F9FA] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900">
                              {pt.fullName}
                            </span>
                            <span className="rounded bg-white border border-slate-200 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-600 tabular-nums">
                              {pt.patientCode}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold tabular-nums ${
                                pt.daysUntilFollowup < 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : pt.daysUntilFollowup === 0
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-teal-100 text-teal-900'
                              }`}
                            >
                              {pt.daysUntilFollowup < 0
                                ? `${Math.abs(pt.daysUntilFollowup)}d Overdue`
                                : pt.daysUntilFollowup === 0
                                  ? 'Due Today'
                                  : `Due in ${pt.daysUntilFollowup}d (${pt.nextFollowupDate})`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {pt.followupReason || 'Scheduled Clinical Review'} ·{' '}
                            <span className="font-mono">{pt.phone}</span>
                          </p>
                        </div>

                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 shrink-0"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Send WhatsApp Recall
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-rose-600" />
                  Installment &amp; Procedure Balance Dues ({balanceDuePatients.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track pending RCT/crown or multi-session package installments and settle balances in 1 tap.
                </p>
              </div>

              {balanceDuePatients.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  All patient accounts are 100% settled!
                </div>
              ) : (
                <div className="space-y-3">
                  {balanceDuePatients.map((pt) => (
                    <div
                      key={pt.id}
                      className="rounded-2xl border border-slate-200/80 bg-[#F8F9FA] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900">
                            {pt.fullName}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            ({pt.patientCode})
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 tabular-nums">
                          {pt.activePackageName || 'Consultation / Procedure'} · Paid{' '}
                          {formatRupeesCompactFromPaise(pt.amountPaidPaise)} of{' '}
                          {formatRupeesCompactFromPaise(pt.totalBilledPaise)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCollectTarget(pt);
                          setCollectRupees(
                            String(Math.round(pt.balanceDuePaise / 100)),
                          );
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F1115] px-4 py-2 text-xs font-extrabold text-[#C8F135] hover:bg-slate-800 cursor-pointer shrink-0 tabular-nums"
                      >
                        Collect {formatRupeesCompactFromPaise(pt.balanceDuePaise)} ✓
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== SECTION 4: DOCTORS & COMMISSIONS ==================== */}
        {activeNav === 'doctors_commissions' && (
          <div className="grid gap-6 lg:grid-cols-12">
            <form
              onSubmit={(e) => void handleSaveDoctor(e)}
              className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4 h-fit"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingDoctorId
                    ? 'Edit Doctor & Cabin'
                    : '+ Add Doctor / Specialist Cabin'}
                </h3>
                {editingDoctorId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDoctorId(null);
                      setDocName('');
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Doctor Full Name
                </label>
                <input
                  type="text"
                  required
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Dr. Ananya Sharma"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Specialty / Department
                  </label>
                  <input
                    type="text"
                    list="clinicSpecialtyList"
                    required
                    value={docSpecialty}
                    onChange={(e) => setDocSpecialty(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                  />
                  <datalist id="clinicSpecialtyList">
                    {CLINIC_SPECIALTY_PRESETS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Consultation Cabin
                  </label>
                  <input
                    type="text"
                    required
                    value={docCabin}
                    onChange={(e) => setDocCabin(e.target.value)}
                    placeholder="Room 1"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    OPD Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={docFeeRupees}
                    onChange={(e) => setDocFeeRupees(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold tabular-nums focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Avg Consult (m)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={docAvgMins}
                    onChange={(e) => setDocAvgMins(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold tabular-nums focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Commission (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={docCommPct}
                    onChange={(e) => setDocCommPct(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold tabular-nums focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={docAvailable}
                  onChange={(e) => setDocAvailable(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#0D9488]"
                />
                Available for live patient QR token check-ins
              </label>

              <button
                type="submit"
                disabled={savingDoctor}
                className="w-full rounded-xl bg-[#0D9488] py-2.5 text-xs font-extrabold text-white hover:bg-[#0F766E] disabled:opacity-50 cursor-pointer"
              >
                {savingDoctor
                  ? 'Saving…'
                  : editingDoctorId
                    ? 'Update Doctor & Cabin'
                    : 'Save Doctor & Cabin'}
              </button>
            </form>

            <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Award className="h-5 w-5 text-[#0D9488]" />
                    Doctor Commission Payouts Ledger
                  </h3>
                  <p className="text-xs text-slate-500">
                    Automatic split computed on every completed consultation (`fee × commission_percent`).
                  </p>
                </div>
                {commissions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCommissionsCsv}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Doctor &amp; Cabin</th>
                      <th className="px-3 py-3">Share %</th>
                      <th className="px-3 py-3">Today Payout</th>
                      <th className="px-3 py-3">Month Gross</th>
                      <th className="px-3 py-3">Month Payout</th>
                      <th className="px-3 py-3 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs tabular-nums">
                    {commissions.map((row) => {
                      const fullDoc = doctors.find(
                        (d) => d.id === row.doctorId,
                      );
                      return (
                        <tr key={row.doctorId} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3.5">
                            <div className="font-extrabold text-slate-900">
                              {row.doctorName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {row.cabinLabel} · {row.specialty}
                            </div>
                          </td>
                          <td className="px-3 py-3.5 font-bold text-slate-700">
                            {row.commissionPercent}%
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="font-extrabold text-[#0D9488]">
                              {formatRupeesCompactFromPaise(
                                row.commissionTodayPaise,
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-400">
                              {row.consultationsToday} visits
                            </div>
                          </td>
                          <td className="px-3 py-3.5 font-semibold text-slate-700">
                            {formatRupeesCompactFromPaise(
                              row.grossFeesThisMonthPaise,
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 font-extrabold text-emerald-800">
                              {formatRupeesCompactFromPaise(
                                row.commissionThisMonthPaise,
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            {fullDoc && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDoctorId(fullDoc.id);
                                  setDocName(fullDoc.doctorName);
                                  setDocSpecialty(fullDoc.specialty);
                                  setDocCabin(fullDoc.cabinLabel);
                                  setDocFeeRupees(
                                    String(
                                      Math.round(
                                        fullDoc.consultationFeePaise / 100,
                                      ),
                                    ),
                                  );
                                  setDocAvgMins(
                                    String(fullDoc.avgConsultMinutes),
                                  );
                                  setDocCommPct(
                                    String(fullDoc.commissionPercent),
                                  );
                                  setDocAvailable(fullDoc.isAvailable);
                                }}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== SECTION 5: PACKAGES & BRANDING ==================== */}
        {activeNav === 'packages_branding' && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Multi-Session Treatment Package Assigner */}
              <form
                onSubmit={(e) => void handleAssignPackage(e)}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4"
              >
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-[#0D9488]" />
                    Assign Multi-Session Treatment Package
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Physio 10-packs, Root Canal + Crown plans, or Derma Laser packages with automatic installment balance tracking.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {CLINIC_TREATMENT_PACKAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setPkgName(preset.name);
                        setPkgSessions(String(preset.sessionsTotal));
                        setPkgFeeRupees(String(Math.round(preset.feePaise / 100)));
                        setPkgPaidRupees(
                          String(Math.round(preset.feePaise / 200)),
                        );
                        setPkgReason(preset.defaultFollowupReason);
                      }}
                      className="rounded-xl border border-teal-200 bg-teal-50/70 px-2.5 py-1 text-[11px] font-bold text-[#0D9488] hover:bg-teal-100 cursor-pointer"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Select Patient
                  </label>
                  <select
                    value={pkgPatientId}
                    onChange={(e) => setPkgPatientId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-[#0D9488] focus:outline-none"
                  >
                    <option value="">— Choose patient —</option>
                    {allPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} ({p.patientCode} · {p.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Package / Procedure Name
                    </label>
                    <input
                      type="text"
                      required
                      value={pkgName}
                      onChange={(e) => setPkgName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Total Sessions
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={pkgSessions}
                      onChange={(e) => setPkgSessions(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold tabular-nums focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Total Package Fee (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pkgFeeRupees}
                      onChange={(e) => setPkgFeeRupees(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold tabular-nums focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Paid Today / Advance (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pkgPaidRupees}
                      onChange={(e) => setPkgPaidRupees(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold tabular-nums focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Next Session / Recall Date
                    </label>
                    <input
                      type="date"
                      value={pkgNextDate}
                      onChange={(e) => setPkgNextDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs tabular-nums focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Recall Note
                    </label>
                    <input
                      type="text"
                      value={pkgReason}
                      onChange={(e) => setPkgReason(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPackage}
                  className="w-full rounded-xl bg-[#0D9488] py-2.5 text-xs font-extrabold text-white hover:bg-[#0F766E] disabled:opacity-50 cursor-pointer"
                >
                  {savingPackage
                    ? 'Assigning Package…'
                    : 'Assign Treatment Package & Update Ledger'}
                </button>
              </form>

              {/* White-Label Clinic Branding Card */}
              <form
                onSubmit={(e) => void handleSaveBranding(e)}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4"
              >
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Palette className="h-5 w-5 text-[#0D9488]" />
                    White-Label Clinic Portal Branding
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Customize your clinic logo, tagline, accent color, and recall window for `/r/{business.slug}/clinic`.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Clinic Portal Tagline
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={brandTagline}
                    onChange={(e) => setBrandTagline(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Clinic Logo (Upload or URL)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
                      <Upload className="h-3.5 w-3.5 text-[#0D9488]" />
                      Upload Logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBrandLogoFile}
                        className="sr-only"
                      />
                    </label>
                    <input
                      type="url"
                      value={brandLogoUrl.startsWith('data:') ? '' : brandLogoUrl}
                      onChange={(e) => setBrandLogoUrl(e.target.value)}
                      placeholder="https://... logo URL (optional)"
                      className="flex-1 min-w-[180px] rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                    />
                    {brandLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setBrandLogoUrl('')}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Medical Accent Color
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {CLINIC_ACCENT_PRESETS.map((p) => (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => setBrandAccent(p.hex)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer ${
                          brandAccent.toLowerCase() === p.hex.toLowerCase()
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: p.hex }}
                        />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={brandQueueOpen}
                      onChange={(e) => setBrandQueueOpen(e.target.checked)}
                      className="h-4 w-4 accent-[#0D9488]"
                    />
                    Accept Live QR Check-Ins
                  </label>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs">
                    <span className="font-bold text-slate-700">Recall Radar:</span>
                    <select
                      value={brandRecallDays}
                      onChange={(e) =>
                        setBrandRecallDays(Number.parseInt(e.target.value, 10))
                      }
                      className="font-extrabold text-[#0D9488] bg-transparent focus:outline-none tabular-nums"
                    >
                      <option value={3}>3 Days</option>
                      <option value={5}>5 Days</option>
                      <option value={7}>7 Days</option>
                      <option value={14}>14 Days</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingBranding}
                  className="w-full rounded-xl bg-[#0F1115] py-2.5 text-xs font-extrabold text-[#C8F135] hover:bg-slate-800 cursor-pointer"
                >
                  {savingBranding
                    ? 'Saving Branding…'
                    : 'Save White-Label Clinic Settings'}
                </button>
              </form>
            </div>

            {/* Reception Standee Studio */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Reception Desk QR Standee (&ldquo;Scan for Live Queue Token &amp; Digital Prescription Pass&rdquo;)
                </h3>
                <p className="text-xs text-slate-500">
                  Print and place at reception so arriving patients check in for their OPD token and view prescriptions on their phone.
                </p>
              </div>
              <QRPosterGenerator business={business} defaultMode="clinic" />
            </div>
          </div>
        )}

        {/* ==================== SECTION 6: AI GOOGLE REVIEWS ==================== */}
        {activeNav === 'ai_reviews' && (
          <div className="space-y-5">
            <div className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs">
              {(
                [
                  { id: 'qr', label: 'Reception Standee & Review QR', Icon: QrCode },
                  {
                    id: 'drafts',
                    label: `Patient Feedback (${drafts.length})`,
                    Icon: FileText,
                  },
                  { id: 'analytics', label: 'Review Funnel', Icon: BarChart3 },
                  { id: 'settings', label: 'AI & Google Link', Icon: Settings },
                ] as const
              ).map((t) => {
                const Icon = t.Icon;
                const active = aiSubTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAiSubTab(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#0F1115] text-[#C8F135]'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {aiSubTab === 'qr' && (
              <QRPosterGenerator business={business} defaultMode="clinic" />
            )}
            {aiSubTab === 'drafts' && (
              <CustomerDraftsView
                business={business}
                drafts={drafts}
                onDraftUpdated={(updated) =>
                  setDrafts((prev) =>
                    prev.map((d) => (d.id === updated.id ? updated : d)),
                  )
                }
              />
            )}
            {aiSubTab === 'analytics' && (
              <AnalyticsView
                metrics={metrics}
                events={events}
                businessName={business.name}
              />
            )}
            {aiSubTab === 'settings' && (
              <div className="space-y-6">
                <GoogleUrlSettings
                  business={business}
                  onUpdated={onBusinessUpdated}
                />
                <AIConfigurationSettings business={business} />
                <BusinessKnowledgeSettings business={business} />
                <BusinessCategorySettings
                  business={business}
                  onUpdated={onBusinessUpdated}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== MODAL 1: + ADD WALK-IN PATIENT ==================== */}
      {walkInOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
          onClick={() => setWalkInOpen(false)}
        >
          <form
            onSubmit={(e) => void handleAddWalkIn(e)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  + Issue Reception Walk-In Token
                </h3>
                <p className="text-xs text-slate-500">
                  Auto-assigns sequential daily OPD token (`#C-01`, `#C-02`…) &amp; `PT-XXX` ID.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWalkInOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="e.g. Priya Kulkarni"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  placeholder="98490 12345"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono tabular-nums focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Age
                </label>
                <input
                  type="number"
                  min={0}
                  max={130}
                  value={walkInAge}
                  onChange={(e) => setWalkInAge(e.target.value)}
                  placeholder="32"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs tabular-nums focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Gender
                </label>
                <select
                  value={walkInGender}
                  onChange={(e) =>
                    setWalkInGender(e.target.value as ClinicPatientGender | '')
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Blood Group
                </label>
                <input
                  type="text"
                  value={walkInBloodGroup}
                  onChange={(e) => setWalkInBloodGroup(e.target.value)}
                  placeholder="O+"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Doctor / Cabin
                </label>
                <select
                  value={walkInDoctorId}
                  onChange={(e) => setWalkInDoctorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:border-[#0D9488] focus:outline-none"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.doctorName} ({d.cabinLabel} · ~{d.estimatedWaitMinutes}m)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Visit Type
                </label>
                <select
                  value={walkInVisitType}
                  onChange={(e) =>
                    setWalkInVisitType(e.target.value as ClinicVisitType)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="walk_in">New Walk-In Consultation</option>
                  <option value="followup">Follow-Up Review</option>
                  <option value="package_session">Treatment Package Session</option>
                  <option value="appointment">Scheduled Appointment</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-rose-700">
                Known Drug / Medical Allergies (Highlighted in Red for Doctor)
              </label>
              <input
                type="text"
                value={walkInAllergies}
                onChange={(e) => setWalkInAllergies(e.target.value)}
                placeholder="e.g. Penicillin, Sulfa drugs, Ibuprofen (leave blank if none)"
                className="w-full rounded-xl border border-rose-200 bg-rose-50/40 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Chief Complaint / Symptoms
              </label>
              <input
                type="text"
                value={walkInComplaint}
                onChange={(e) => setWalkInComplaint(e.target.value)}
                placeholder="e.g. Tooth sensitivity, lower back pain, fever & throat pain"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWalkInOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingWalkIn}
                className="rounded-xl bg-[#0F1115] px-5 py-2 text-xs font-extrabold text-[#C8F135] hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {savingWalkIn ? 'Issuing Token…' : 'Issue Live Token →'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL 2: QUICK VITALS POPOVER ==================== */}
      {vitalsTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
          onClick={() => setVitalsTarget(null)}
        >
          <form
            onSubmit={(e) => void handleSaveVitals(e)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Record Triage Vitals ({vitalsTarget.tokenNumber})
                </h3>
                <p className="text-xs text-slate-500">
                  {vitalsTarget.patientName} ({vitalsTarget.patientCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVitalsTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 tabular-nums">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  BP (mmHg)
                </label>
                <input
                  type="text"
                  value={vitalBp}
                  onChange={(e) => setVitalBp(e.target.value)}
                  placeholder="120/80"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Pulse (bpm)
                </label>
                <input
                  type="text"
                  value={vitalPulse}
                  onChange={(e) => setVitalPulse(e.target.value)}
                  placeholder="76"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Temp (°F)
                </label>
                <input
                  type="text"
                  value={vitalTemp}
                  onChange={(e) => setVitalTemp(e.target.value)}
                  placeholder="98.6"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Weight (kg)
                </label>
                <input
                  type="text"
                  value={vitalWeight}
                  onChange={(e) => setVitalWeight(e.target.value)}
                  placeholder="68"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVitalsTarget(null)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingVitals}
                className="rounded-xl bg-[#0D9488] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#0F766E] cursor-pointer"
              >
                {savingVitals ? 'Saving…' : 'Save Vitals ✓'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== DRAWER 3: DOCTOR CONSULTATION & DIGITAL RX ==================== */}
      {rxTarget && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-[1px]"
          onClick={() => setRxTarget(null)}
        >
          <form
            onSubmit={(e) => void handleCompleteConsultation(e)}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl overflow-y-auto"
          >
            {/* Obsidian Drawer Header */}
            <div className="bg-[#0F1115] px-6 py-5 text-white flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-[#C8F135] px-2.5 py-0.5 text-xs font-black text-[#0F1115] tabular-nums">
                    {rxTarget.tokenNumber}
                  </span>
                  <span className="text-base font-extrabold">
                    {rxTarget.patientName}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    ({rxTarget.patientCode})
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {rxTarget.doctorName ?? 'Attending Doctor'} ·{' '}
                  {rxTarget.cabinLabel ?? 'OPD'} · Complaint:{' '}
                  <strong className="text-white">
                    {rxTarget.chiefComplaint || 'General consultation'}
                  </strong>
                </p>
                {rxTarget.patientAllergies && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-rose-500/20 border border-rose-400/40 px-3 py-1 text-xs font-extrabold text-rose-200">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />
                    ALLERGY ALERT: {rxTarget.patientAllergies}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRxTarget(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 p-6 space-y-5">
              {/* Diagnosis Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  1. Clinical Diagnosis &amp; Treatment Notes
                </label>
                <textarea
                  rows={2}
                  value={rxDiagnosis}
                  onChange={(e) => setRxDiagnosis(e.target.value)}
                  placeholder="e.g. Acute pulpitis on #36; root canal access opening done, calcium hydroxide dressing placed."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              {/* Structured Prescription (Rx) Rows */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    2. Digital Prescription (Rx) Medicines
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setRxItems((prev) => [
                        ...prev,
                        {
                          medicineName: '',
                          dosage: '1-0-1 After Food',
                          days: 5,
                          instruction: '',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-extrabold text-[#0D9488] hover:bg-teal-100 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Medicine Row
                  </button>
                </div>

                <div className="space-y-2">
                  {rxItems.map((item, idx) => (
                    <div
                      key={`rx-row-${idx}`}
                      className="grid grid-cols-12 gap-2 rounded-xl border border-slate-200/80 bg-[#F8F9FA] p-2.5 items-center"
                    >
                      <input
                        type="text"
                        value={item.medicineName}
                        onChange={(e) =>
                          setRxItems((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, medicineName: e.target.value }
                                : r,
                            ),
                          )
                        }
                        placeholder="Medicine (e.g. Augmentin 625mg)"
                        className="col-span-12 sm:col-span-4 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-[#0D9488] focus:outline-none"
                      />
                      <input
                        type="text"
                        list="clinicDosagePresets"
                        value={item.dosage}
                        onChange={(e) =>
                          setRxItems((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, dosage: e.target.value } : r,
                            ),
                          )
                        }
                        placeholder="1-0-1 After Food"
                        className="col-span-6 sm:col-span-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-[#0D9488] focus:outline-none"
                      />
                      <div className="col-span-4 sm:col-span-2 flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={item.days}
                          onChange={(e) =>
                            setRxItems((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      days:
                                        Number.parseInt(e.target.value, 10) || 1,
                                    }
                                  : r,
                              ),
                            )
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold tabular-nums focus:border-[#0D9488] focus:outline-none"
                        />
                        <span className="text-[10.5px] text-slate-500">d</span>
                      </div>
                      <input
                        type="text"
                        value={item.instruction ?? ''}
                        onChange={(e) =>
                          setRxItems((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, instruction: e.target.value }
                                : r,
                            ),
                          )
                        }
                        placeholder="Note (e.g. Warm salt gargle)"
                        className="col-span-10 sm:col-span-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-[#0D9488] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setRxItems((prev) =>
                            prev.length > 1
                              ? prev.filter((_, i) => i !== idx)
                              : prev,
                          )
                        }
                        className="col-span-2 sm:col-span-1 flex justify-center text-slate-400 hover:text-rose-600 cursor-pointer"
                        aria-label="Remove medicine"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <datalist id="clinicDosagePresets">
                    {CLINIC_DOSAGE_PRESETS.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Handwritten Rx / X-Ray / Lab Photo Upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  3. Attach Handwritten Rx, Dental X-Ray, or Lab Report (Optional)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
                    <Upload className="h-3.5 w-3.5 text-[#0D9488]" />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleRxPhotoFile}
                      className="sr-only"
                    />
                  </label>
                  <input
                    type="url"
                    value={rxPhotoUrl.startsWith('data:') ? '' : rxPhotoUrl}
                    onChange={(e) => setRxPhotoUrl(e.target.value)}
                    placeholder="Or paste Rx / Lab image URL..."
                    className="flex-1 min-w-[180px] rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                  />
                  {rxPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setRxPhotoUrl('')}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-700 cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Billing, Package Session Deduction & Commission Preview */}
              <div className="rounded-2xl border border-slate-200 bg-[#F8F9FA] p-4 space-y-3 tabular-nums">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  4. Consultation Billing, Package Credit &amp; Commission
                </p>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Fee Charged (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={rxFeeRupees}
                      onChange={(e) => setRxFeeRupees(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Collected Now (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={rxCollectedRupees}
                      onChange={(e) => setRxCollectedRupees(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Payment Mode
                    </label>
                    <select
                      value={rxPaymentMethod}
                      onChange={(e) =>
                        setRxPaymentMethod(
                          e.target.value as ClinicPaymentMethod,
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold focus:border-[#0D9488] focus:outline-none"
                    >
                      <option value="upi">UPI</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="package_credit">Package Credit</option>
                    </select>
                  </div>
                </div>

                {(rxTarget.patientPackageRemaining ?? 0) > 0 && (
                  <label className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 py-2.5 text-xs font-bold text-teal-950 cursor-pointer">
                    <span>
                      Deduct 1 session from{' '}
                      <strong>{rxTarget.patientPackageName}</strong> (
                      {rxTarget.patientPackageRemaining} →{' '}
                      {Math.max(0, (rxTarget.patientPackageRemaining ?? 0) - 1)}{' '}
                      left)
                    </span>
                    <input
                      type="checkbox"
                      checked={rxDeductPackage}
                      onChange={(e) => setRxDeductPackage(e.target.checked)}
                      className="h-4 w-4 accent-[#0D9488]"
                    />
                  </label>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
                  <span>
                    Doctor Share ({rxDoc?.commissionPercent ?? 0}%):{' '}
                    <strong className="text-[#0D9488]">
                      {formatRupeesCompactFromPaise(rxCommissionPreviewPaise)}
                    </strong>
                  </span>
                  <span>
                    Added to Balance Due:{' '}
                    <strong
                      className={
                        rxNewDuePreviewPaise > 0
                          ? 'text-rose-600'
                          : 'text-emerald-700'
                      }
                    >
                      {formatRupeesCompactFromPaise(rxNewDuePreviewPaise)}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Next Follow-Up / Recall Date Picker */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    5. Next Follow-Up / Recall Radar Date
                  </label>
                  <div className="flex items-center gap-1">
                    {[
                      { label: '+2 Days', days: 2 },
                      { label: '+3 Days', days: 3 },
                      { label: '+7 Days', days: 7 },
                      { label: '+30 Days', days: 30 },
                    ].map((btn) => (
                      <button
                        key={btn.days}
                        type="button"
                        onClick={() =>
                          setRxFollowupDate(addDaysToIsoDate(todayIso, btn.days))
                        }
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer tabular-nums"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={rxFollowupDate}
                    onChange={(e) => setRxFollowupDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold tabular-nums focus:border-[#0D9488] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={rxFollowupReason}
                    onChange={(e) => setRxFollowupReason(e.target.value)}
                    placeholder="Reason (e.g. 7-Day Post-Op Review)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Sticky Drawer Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setRxTarget(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={completingRx}
                style={{ backgroundColor: accentHex }}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                {completingRx
                  ? 'Publishing Digital Rx…'
                  : 'Complete Visit & Issue Digital Rx ✓'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL 4: COLLECT PATIENT BALANCE ==================== */}
      {collectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
          onClick={() => setCollectTarget(null)}
        >
          <form
            onSubmit={(e) => void handleCollectBalance(e)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 tabular-nums"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Collect Balance Due
                </h3>
                <p className="text-xs text-slate-500">
                  {collectTarget.fullName} ({collectTarget.patientCode}) · Pending{' '}
                  <strong className="text-rose-600">
                    {formatRupeesCompactFromPaise(collectTarget.balanceDuePaise)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollectTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Amount Received Now (₹)
              </label>
              <input
                type="number"
                min={1}
                required
                value={collectRupees}
                onChange={(e) => setCollectRupees(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-extrabold focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Payment Mode
              </label>
              <select
                value={collectMethod}
                onChange={(e) =>
                  setCollectMethod(e.target.value as ClinicPaymentMethod)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold focus:border-[#0D9488] focus:outline-none"
              >
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCollectTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={collectingBalance}
                className="rounded-xl bg-[#0F1115] px-4 py-2 text-xs font-extrabold text-[#C8F135] hover:bg-slate-800 cursor-pointer"
              >
                {collectingBalance ? 'Recording…' : 'Confirm Collection ✓'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL 5: RX PHOTO PREVIEW ==================== */}
      {previewRxVisit && previewRxVisit.rxAttachmentUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setPreviewRxVisit(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full rounded-2xl bg-white p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-slate-900">
                Rx / Lab Attachment — {previewRxVisit.patientName} (
                {previewRxVisit.visitDate})
              </p>
              <button
                type="button"
                onClick={() => setPreviewRxVisit(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={previewRxVisit.rxAttachmentUrl}
              alt="Prescription or Lab Attachment"
              className="max-h-[70vh] w-full rounded-xl object-contain bg-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ClinicManagerView;
