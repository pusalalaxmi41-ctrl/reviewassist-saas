/**
 * Verification Suite — Module 9: ClinicOS (Healthcare, Dental, Skin, Physio & Diagnostic Clinic OS)
 *   1. Multi-Industry Router, ClinicOS Badges & /r/:slug/clinic QR Standee URLs
 *   2. Doctors & Cabins CRUD + Sequential Daily Tokens (#C-01, #C-02...) + Live ETA Math
 *   3. Granular Doctor Delay Adjustments (-2m, +2m, +5m, +10m) Updating Patient ETAs
 *   4. Nurse Vitals Recording + Complete Consultation & Digital Rx Vault + Commission Split
 *   5. Multi-Session Treatment Packages (10 -> 9 Deduction) + Installment Balance Due Collection
 *   6. 3-Day Recall & Follow-Up Radar + Multi-Tenant Isolation + Migration 032 SQL Security Audit
 *
 * Run with: deno run --allow-read --allow-env tests/verify-clinic-os.ts
 */

import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import {
  addDaysToIsoDate,
  getIndustryBadgeMeta,
  getIndustryWorkspaceType,
  getPrimaryCustomerQrUrlForBusiness,
  getTodayIsoDateKey,
} from '../src/utils/gymValidation.ts';
import {
  buildClinicRecallWhatsAppLink,
  buildClinicYoureNextWhatsAppLink,
  calculateClinicEstimatedWaitMinutes,
  calculateDoctorCommissionPaise,
  getClinicPortalUrl,
  isClinicCategory,
  normalizeClinicPhone,
} from '../src/utils/clinicValidation.ts';

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  [PASS] ${message}`);
  } else {
    failed += 1;
    console.error(`  [FAIL] ${message}`, detail ?? '');
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedPattern: RegExp,
  message: string,
): Promise<void> {
  try {
    await fn();
    failed += 1;
    console.error(`  [FAIL] ${message} (Resolved instead of rejecting)`);
  } catch (err) {
    const msg = (err as Error).message || String(err);
    if (expectedPattern.test(msg)) {
      passed += 1;
      console.log(`  [PASS] ${message}`);
    } else {
      failed += 1;
      console.error(
        `  [FAIL] ${message} (Expected ${expectedPattern}, got "${msg}")`,
      );
    }
  }
}

async function runTests(): Promise<void> {
  console.log(
    '\n=== Module 9 Verification: ClinicOS — Live OPD Queue, Vitals, Digital Rx, Packages, 3-Day Recalls & Commissions ===\n',
  );

  // -------------------------------------------------------------------------
  // 1. Multi-Industry Router, Badges & URL Helpers
  // -------------------------------------------------------------------------
  console.log('1. Multi-Industry Router, Standee URLs & Clinic Math Helpers');

  assert(
    isClinicCategory('clinic') &&
      !isClinicCategory('loyalty') &&
      getIndustryWorkspaceType('clinic') === 'clinic' &&
      getIndustryBadgeMeta('clinic').moduleName === 'ClinicOS',
    'category === "clinic" maps cleanly to workspace "clinic" and badge "ClinicOS"',
  );

  assert(
    getClinicPortalUrl('aura-care-clinic', 'https://vitaran.app') ===
      'https://vitaran.app/r/aura-care-clinic/clinic' &&
      getPrimaryCustomerQrUrlForBusiness(
        { slug: 'aura-care-clinic', category: 'clinic' },
        'https://vitaran.app',
      ) === 'https://vitaran.app/r/aura-care-clinic/clinic',
    'Smart QR Standee Router points clinic businesses to /r/:slug/clinic',
  );

  assert(
    normalizeClinicPhone('+91 98490-12345') === '9849012345' &&
      normalizeClinicPhone('09849012345') === '9849012345' &&
      calculateDoctorCommissionPaise(100000, 50) === 50000 &&
      calculateClinicEstimatedWaitMinutes({
        patientsAhead: 2,
        avgConsultMinutes: 15,
        extraDelayMinutes: 5,
      }) === 35,
    'Phone normalizer, commission split, and linear wait-time formula compute accurately',
  );

  const nextWa = buildClinicYoureNextWhatsAppLink({
    phone: '9849012345',
    patientName: 'Aarav',
    tokenNumber: '#C-02',
    clinicName: 'Lotus Dental',
    doctorName: 'Dr. Ananya Sharma',
    cabinLabel: 'Room 1',
    businessSlug: 'lotus-dental',
  });
  const recallWa = buildClinicRecallWhatsAppLink({
    phone: '9849012345',
    patientName: 'Aarav',
    clinicName: 'Lotus Dental',
    followupDate: '2026-11-28',
    followupReason: '7-Day Post-Op Review',
    balanceDuePaise: 150000,
    businessSlug: 'lotus-dental',
  });
  assert(
    nextWa.startsWith('https://wa.me/919849012345?text=') &&
      decodeURIComponent(nextWa).includes('#C-02') &&
      recallWa.startsWith('https://wa.me/919849012345?text=') &&
      decodeURIComponent(recallWa).includes('7-Day Post-Op Review'),
    'WhatsApp "You\'re Next" and "3-Day Recall" deep-links encode token & recall context',
  );

  // -------------------------------------------------------------------------
  // 2. Clinic Provisioning, Doctors/Cabins & Sequential Daily Tokens
  // -------------------------------------------------------------------------
  console.log('\n2. Doctors/Cabins CRUD & Sequential Daily OPD Tokens (#C-01, #C-02)');

  const repo = new MockLocalStorageRepository();
  const ownerA = { actorOwnerId: 'owner-clinic-alpha-1' };
  const ownerB = { actorOwnerId: 'owner-clinic-beta-2' };

  const clinicA = await repo.createBusiness({
    name: 'Lotus Dental & Physio Care',
    category: 'clinic',
    city: 'Hyderabad',
    slug: 'lotus-dental-care',
    googleReviewUrl: 'https://g.page/r/lotus-dental/review',
    googleReviewUrlIsPlaceholder: false,
    ownerId: ownerA.actorOwnerId,
  });
  const clinicB = await repo.createBusiness({
    name: 'rival-skin-clinic',
    category: 'clinic',
    city: 'Bengaluru',
    slug: 'rival-skin-clinic',
    googleReviewUrl: 'https://g.page/r/rival-skin/review',
    googleReviewUrlIsPlaceholder: false,
    ownerId: ownerB.actorOwnerId,
  });

  assert(
    (await repo.getPublicClinicHub(clinicA.slug)) === null,
    'Unapproved (pending) clinic is hidden from public /r/:slug/clinic hub',
  );

  // Activate both clinics for live OPD operations
  await repo.setMockBusinessStatus(clinicA.id, 'active');
  await repo.setMockBusinessStatus(clinicB.id, 'active');

  const docAnanya = await repo.upsertClinicDoctor(
    clinicA.id,
    {
      doctorName: 'Dr. Ananya Sharma',
      specialty: 'Dental & Implantology',
      cabinLabel: 'Room 1',
      consultationFeePaise: 50000,
      avgConsultMinutes: 15,
      commissionPercent: 50,
      isAvailable: true,
    },
    ownerA,
  );
  const docVikram = await repo.upsertClinicDoctor(
    clinicA.id,
    {
      doctorName: 'Dr. Vikram Nair',
      specialty: 'Physiotherapy',
      cabinLabel: 'Room 2',
      consultationFeePaise: 60000,
      avgConsultMinutes: 20,
      commissionPercent: 40,
      isAvailable: true,
    },
    ownerA,
  );

  assert(
    docAnanya.cabinLabel === 'Room 1' &&
      docAnanya.commissionPercent === 50 &&
      docVikram.cabinLabel === 'Room 2',
    'Added 2 specialist doctors/cabins (Dr. Ananya Room 1 50%, Dr. Vikram Room 2 40%)',
  );

  // Walk-in Patient 1 -> #C-01 (0 ahead, 0m wait)
  const t1 = await repo.checkinOrBookClinicToken({
    businessSlug: clinicA.slug,
    fullName: 'Rahul Mehta',
    phone: '+91 90000 10001',
    doctorId: docAnanya.id,
    visitType: 'walk_in',
    chiefComplaint: 'Upper molar sensitivity',
    age: 31,
    allergies: 'Penicillin, Sulfa drugs',
  });
  assert(
    t1.tokenNumber === '#C-01' &&
      t1.patientCode === 'PT-001' &&
      t1.patientsAhead === 0 &&
      t1.estimatedWaitMinutes === 0,
    'First walk-in patient receives Token #C-01, PT-001, 0 ahead, ~0m wait',
  );

  // Follow-up Patient 2 -> #C-02 on same doctor (1 ahead -> 15m wait)
  const t2 = await repo.checkinOrBookClinicToken({
    businessSlug: clinicA.slug,
    fullName: 'Sneha Reddy',
    phone: '9000010002',
    doctorId: docAnanya.id,
    visitType: 'followup',
    chiefComplaint: 'Crown bite check',
    age: 28,
  });
  assert(
    t2.tokenNumber === '#C-02' &&
      t2.patientCode === 'PT-002' &&
      t2.patientsAhead === 1 &&
      t2.estimatedWaitMinutes === 15,
    'Second patient for Dr. Ananya receives Token #C-02, PT-002, 1 ahead, ~15m wait',
  );

  // Duplicate same-day check-in returns existing #C-02 instead of farming extra tokens
  const t2Dup = await repo.checkinOrBookClinicToken({
    businessSlug: clinicA.slug,
    fullName: 'Sneha Reddy',
    phone: '9000010002',
    doctorId: docAnanya.id,
    visitType: 'followup',
  });
  assert(
    t2Dup.visitId === t2.visitId && t2Dup.tokenNumber === '#C-02',
    'Duplicate check-in by active waiting patient returns existing #C-02 idempotently',
  );

  // Patient 3 on Doctor 2 (Room 2) -> sequential clinic token #C-03, 0 ahead in Room 2!
  const t3 = await repo.checkinOrBookClinicToken({
    businessSlug: clinicA.slug,
    fullName: 'Karan Malhotra',
    phone: '9000010003',
    doctorId: docVikram.id,
    visitType: 'package_session',
    chiefComplaint: 'Lumbar rehab session',
  });
  assert(
    t3.tokenNumber === '#C-03' &&
      t3.patientCode === 'PT-003' &&
      t3.patientsAhead === 0 &&
      t3.estimatedWaitMinutes === 0,
    'Patient checking into Room 2 receives sequential #C-03 with independent Room 2 queue (0 ahead)',
  );

  // -------------------------------------------------------------------------
  // 3. Granular Doctor Delay Adjustments (+2m, +5m, -2m)
  // -------------------------------------------------------------------------
  console.log('\n3. Granular Doctor Delay Adjustments (+2m, +5m, -2m)');

  await repo.adjustClinicDoctorDelay({
    businessId: clinicA.id,
    doctorId: docAnanya.id,
    deltaMinutes: 2,
    options: ownerA,
  });
  await repo.adjustClinicDoctorDelay({
    businessId: clinicA.id,
    doctorId: docAnanya.id,
    deltaMinutes: 5,
    options: ownerA,
  });

  const snehaHubAfterPlus7 = await repo.getPublicClinicHub(
    clinicA.slug,
    '9000010002',
  );
  assert(
    snehaHubAfterPlus7?.activeVisit?.patientsAhead === 1 &&
      snehaHubAfterPlus7?.activeVisit?.estimatedWaitMinutes === 22,
    'Adjusting Dr. Ananya +2m then +5m updates Sneha (#C-02) live ETA from 15m -> 22m',
  );

  await repo.adjustClinicDoctorDelay({
    businessId: clinicA.id,
    doctorId: docAnanya.id,
    deltaMinutes: -2,
    options: ownerA,
  });
  const snehaHubAfterMinus2 = await repo.getPublicClinicHub(
    clinicA.slug,
    '9000010002',
  );
  assert(
    snehaHubAfterMinus2?.activeVisit?.estimatedWaitMinutes === 20,
    'Adjusting Dr. Ananya -2m updates Sneha (#C-02) live ETA from 22m -> 20m',
  );

  // -------------------------------------------------------------------------
  // 4. Vitals Recording, Package Assignment, Digital Rx & Commissions
  // -------------------------------------------------------------------------
  console.log('\n4. Vitals, Multi-Session Package Deduction, Digital Rx & Doctor Commission');

  const today = getTodayIsoDateKey();

  // Assign a 10-Session Ortho Physio Pack to Karan (PT-003) with part-payment (₹8,500 billed, ₹5,000 paid -> ₹3,500 due)
  const karanPacked = await repo.assignClinicTreatmentPackage(
    {
      businessId: clinicA.id,
      patientId: t3.patientId,
      packageName: '10-Session Ortho Physio Pack',
      sessionsTotal: 10,
      packageFeePaise: 850000,
      amountPaidNowPaise: 500000,
      nextFollowupDate: addDaysToIsoDate(today, 2),
      followupReason: 'Session 2 of 10 — Core Stabilization',
    },
    ownerA,
  );
  assert(
    karanPacked.packageSessionsTotal === 10 &&
      karanPacked.packageSessionsRemaining === 10 &&
      karanPacked.balanceDuePaise === 350000,
    'Assigned 10-Session Ortho Physio Pack (₹8,500 billed, ₹5,000 paid -> ₹3,500 installment due)',
  );

  // Record vitals for Rahul (#C-01) and move to in_consultation
  const vitalsDone = await repo.updateClinicVisitVitalsAndStatus({
    businessId: clinicA.id,
    visitId: t1.visitId,
    status: 'vitals_done',
    vitalsJson: { bp: '120/80', pulse: '76', tempF: '98.6', weightKg: '68' },
    options: ownerA,
  });
  assert(
    vitalsDone.status === 'vitals_done' &&
      vitalsDone.vitalsJson.bp === '120/80' &&
      vitalsDone.vitalsJson.tempF === '98.6',
    'Nurse recorded triage vitals (BP 120/80, 98.6°F) and advanced status to vitals_done',
  );

  await repo.updateClinicVisitVitalsAndStatus({
    businessId: clinicA.id,
    visitId: t1.visitId,
    status: 'in_consultation',
    options: ownerA,
  });
  const rahulInConsultHub = await repo.getPublicClinicHub(
    clinicA.slug,
    '9000010001',
  );
  assert(
    rahulInConsultHub?.activeVisit?.status === 'in_consultation' &&
      rahulInConsultHub?.activeVisit?.estimatedWaitMinutes === 0,
    'Calling Rahul into Room 1 triggers IN CONSULTATION live banner on mobile pass',
  );

  // Complete Rahul's dental consultation (₹1,200 procedure fee, ₹800 collected -> ₹400 due; 50% commission = ₹600)
  const completedRahul = await repo.completeClinicConsultationAndRx(
    {
      businessId: clinicA.id,
      visitId: t1.visitId,
      diagnosisNotes: 'Reversible pulpitis #16; composite restoration completed.',
      prescriptionItems: [
        {
          medicineName: 'Clindamycin 300mg (Penicillin-Safe)',
          dosage: '1-0-1 After Food',
          days: 5,
          instruction: 'Swallow whole with water',
        },
        {
          medicineName: 'Ketorol DT 10mg',
          dosage: 'SOS (When Needed)',
          days: 3,
          instruction: 'Warm salt gargle twice daily',
        },
      ],
      rxAttachmentUrl: 'https://cdn.vitaran.app/demo/rahul-dental-xray.webp',
      feeChargedPaise: 120000,
      amountCollectedPaise: 80000,
      paymentMethod: 'upi',
      deductPackageSession: false,
      nextFollowupDate: addDaysToIsoDate(today, 3),
      followupReason: '3-Day Bite & Sensitivity Check',
    },
    ownerA,
  );

  assert(
    completedRahul.visit.status === 'completed' &&
      completedRahul.visit.doctorCommissionPaise === 60000 &&
      completedRahul.visit.prescriptionItems.length === 2 &&
      completedRahul.visit.rxAttachmentUrl ===
        'https://cdn.vitaran.app/demo/rahul-dental-xray.webp' &&
      completedRahul.patient.balanceDuePaise === 40000 &&
      completedRahul.patient.totalVisits === 1 &&
      completedRahul.patient.nextFollowupDate === addDaysToIsoDate(today, 3),
    'Completed consultation saves Digital Rx + X-ray URL, computes 50% doctor commission (₹600), tracks ₹400 due & sets 3-day recall',
  );

  // Complete Karan's package session with deductPackageSession = true (10 -> 9 remaining)
  const completedKaran = await repo.completeClinicConsultationAndRx(
    {
      businessId: clinicA.id,
      visitId: t3.visitId,
      diagnosisNotes: 'Session 1 completed — IFT + lumbar mobilization.',
      prescriptionItems: [
        {
          medicineName: 'Volini Gel',
          dosage: 'Twice Daily Topical',
          days: 7,
          instruction: 'Gentle application after hot pack',
        },
      ],
      feeChargedPaise: 0,
      amountCollectedPaise: 0,
      paymentMethod: 'package_credit',
      deductPackageSession: true,
      nextFollowupDate: addDaysToIsoDate(today, 1),
      followupReason: 'Session 2 of 10 — Physio Rehab',
    },
    ownerA,
  );

  assert(
    completedKaran.patient.packageSessionsRemaining === 9 &&
      completedKaran.patient.packageSessionsTotal === 10,
    'Completing package consultation decrements Karan\'s remaining sessions from 10 -> 9',
  );

  // Verify Rahul's public Health Pass now shows past Digital Rx & no active waiting token
  const rahulAfterDone = await repo.getPublicClinicHub(
    clinicA.slug,
    '9000010001',
  );
  assert(
    rahulAfterDone?.activeVisit === null &&
      rahulAfterDone?.visitHistory.length === 1 &&
      rahulAfterDone?.visitHistory[0].prescriptionItems[0].medicineName.includes(
        'Clindamycin',
      ) &&
      rahulAfterDone?.patient?.allergies === 'Penicillin, Sulfa drugs',
    'Patient Health Pass displays completed Digital Rx, vitals & allergy alert immediately after completion',
  );

  // -------------------------------------------------------------------------
  // 5. 3-Day Recall Radar, Balance Collection & Owner Dashboard KPIs
  // -------------------------------------------------------------------------
  console.log('\n5. 3-Day Recall Radar, Balance Collection & Commission Ledger');

  const dashBeforeCollect = await repo.getClinicOwnerDashboard(
    clinicA.id,
    ownerA,
  );
  assert(
    dashBeforeCollect.kpis.patientsInQueueNow === 1 && // Sneha (#C-02) still waiting
      dashBeforeCollect.kpis.completedTodayCount === 2 &&
      dashBeforeCollect.kpis.todayRevenuePaise === 80000 &&
      dashBeforeCollect.kpis.recallsDueCount === 2 && // Rahul (+3d) & Karan (+1d)
      dashBeforeCollect.kpis.pendingBalanceDuePaise === 390000 && // ₹3,500 + ₹400
      dashBeforeCollect.doctorCommissionSummary.find(
        (d) => d.doctorId === docAnanya.id,
      )?.commissionTodayPaise === 60000,
    'Owner dashboard aggregates live queue (1), completed (2), today revenue (₹800), 3-day recalls (2), dues (₹3,900) & Dr. Ananya commission (₹600)',
  );

  // Collect Karan's ₹3,500 pending installment balance
  const karanSettled = await repo.collectClinicPatientBalance({
    businessId: clinicA.id,
    patientId: t3.patientId,
    amountCollectedPaise: 350000,
    paymentMethod: 'upi',
    options: ownerA,
  });
  assert(
    karanSettled.balanceDuePaise === 0 &&
      karanSettled.amountPaidPaise === 850000,
    '1-Tap Collect Balance clears Karan\'s ₹3,500 installment due and updates paid total to ₹8,500',
  );

  // White-label clinic branding update
  const updatedBranding = await repo.updateClinicBrandingConfig(
    clinicA.id,
    {
      clinicTagline: 'Painless Laser Dentistry & Spine Rehab',
      accentColor: '#10B981',
      isQueueOpen: true,
      recallWindowDays: 3,
    },
    ownerA,
  );
  assert(
    updatedBranding.clinicTagline ===
      'Painless Laser Dentistry & Spine Rehab' &&
      updatedBranding.accentColor === '#10B981',
    'White-label clinic branding persists custom tagline and accent color',
  );

  // -------------------------------------------------------------------------
  // 6. Strict Multi-Tenant Isolation & Migration 032 Security Audit
  // -------------------------------------------------------------------------
  console.log('\n6. Multi-Tenant Isolation & Migration 032 SQL Security Audit');

  await assertRejects(
    () => repo.getClinicOwnerDashboard(clinicA.id, ownerB),
    /Unauthorized/i,
    'Cross-tenant owner cannot read another clinic\'s OPD dashboard or Rx vault',
  );

  await assertRejects(
    () =>
      repo.adjustClinicDoctorDelay({
        businessId: clinicA.id,
        doctorId: docAnanya.id,
        deltaMinutes: 10,
        options: ownerB,
      }),
    /Unauthorized/i,
    'Cross-tenant owner cannot modify another clinic\'s doctor delay',
  );

  await assertRejects(
    () =>
      repo.collectClinicPatientBalance({
        businessId: clinicA.id,
        patientId: t1.patientId,
        amountCollectedPaise: 40000,
        options: ownerB,
      }),
    /Unauthorized/i,
    'Cross-tenant owner cannot collect or mutate another clinic\'s patient balances',
  );

  const clinicBHub = await repo.getPublicClinicHub(clinicB.slug, '9000010001');
  assert(
    clinicBHub !== null &&
      clinicBHub.doctors.length === 0 &&
      clinicBHub.patient === null &&
      clinicBHub.visitHistory.length === 0,
    'Clinic B public portal has zero leakage of Clinic A doctors, patients, or prescriptions',
  );

  // Static audit of Migration 032
  const sql = await Deno.readTextFile(
    'supabase/migrations/032_clinic_os_queue_rx_recalls_and_payouts.sql',
  );
  assert(
    sql.includes('alter table public.clinic_configs enable row level security') &&
      sql.includes('alter table public.clinic_configs force row level security') &&
      sql.includes('revoke all on table public.clinic_configs from public, anon') &&
      sql.includes('alter table public.clinic_doctors enable row level security') &&
      sql.includes('alter table public.clinic_doctors force row level security') &&
      sql.includes('revoke all on table public.clinic_doctors from public, anon') &&
      sql.includes('alter table public.clinic_patients enable row level security') &&
      sql.includes('alter table public.clinic_patients force row level security') &&
      sql.includes('revoke all on table public.clinic_patients from public, anon') &&
      sql.includes(
        'alter table public.clinic_visits_and_queue enable row level security',
      ) &&
      sql.includes(
        'alter table public.clinic_visits_and_queue force row level security',
      ) &&
      sql.includes(
        'revoke all on table public.clinic_visits_and_queue from public, anon',
      ),
    'Migration 032 enforces ENABLE + FORCE RLS and REVOKE ALL FROM public, anon on all 4 ClinicOS tables',
  );

  assert(
    sql.includes('pg_catalog.substr(') &&
      !/pg_catalog\.substring\s*\([^)]*\bfrom\b/i.test(sql) &&
      !/\bsubstring\s*\([^)]*\bfrom\b/i.test(sql) &&
      sql.includes('set search_path = pg_catalog, public, pg_temp'),
    'Migration 032 strictly uses pg_catalog.substr() and hardened search_path on all RPCs',
  );

  if (failed > 0) {
    console.error(`\n❌ ${failed} ClinicOS assertion(s) failed.`);
    Deno.exit(1);
  }

  console.log(`\n🎉 ALL ${passed} MODULE 9 (CLINICOS) ASSERTIONS PASSED!\n`);
}

void runTests();
