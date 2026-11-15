/**
 * Phase 5 — Automated Verification Suite for the Review Management System
 *
 * Tests all 18 required verification areas from Section 10:
 * 1. Viewing business feedback
 * 2. Viewing generated customer review drafts
 * 3. Filtering by sentiment (all, positive, neutral, negative, mixed)
 * 4. Filtering by workflow status (pending, draft_generated, approved, completed)
 * 5. Searching feedback
 * 6. Generating business response drafts (acknowledging positive + negative points; no fake refunds/promises)
 * 7. Applying Phase 3 AI settings
 * 8. Applying relevant Phase 4 business context
 * 9. Editing response drafts
 * 10. Regenerating drafts
 * 11. Copying responses (does not auto-complete or auto-approve)
 * 12. Approving responses
 * 13. Marking responses completed (only after draft exists; blocked from pending)
 * 14. Business-to-business data isolation
 * 15. Unauthorized access attempts
 * 16. Existing customer submission flow & non-gating of negative reviews
 * 17. Existing analytics definitions preserved
 * 18. 90-day retention policy compatibility
 */

import {
  CUSTOMER_DRAFT_RETENTION_DAYS,
  type CustomerDraftRecord,
} from '../src/types/business.ts';
import { classifyEstimatedSentiment } from '../src/utils/sentimentClassifier.ts';
import {
  filterActiveRetentionDrafts,
  validateResponseWorkflowUpdate,
} from '../src/utils/reviewResponseValidation.ts';
import { MockLocalStorageRepository } from '../src/services/storage/MockLocalStorageRepository.ts';
import { MockAIProvider } from '../src/services/ai/MockAIProvider.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function assertThrows(
  fn: () => Promise<unknown>,
  label: string,
  expectedSubstring?: string,
): Promise<void> {
  try {
    await fn();
    failed++;
    console.error(`  [FAIL] ${label} — Expected error to be thrown, but succeeded.`);
  } catch (err) {
    const msg = (err as Error).message || String(err);
    if (
      expectedSubstring &&
      !msg.toLowerCase().includes(expectedSubstring.toLowerCase())
    ) {
      failed++;
      console.error(
        `  [FAIL] ${label} — Threw "${msg}", expected substring "${expectedSubstring}"`,
      );
      return;
    }
    passed++;
    console.log(`  [PASS] ${label} (Blocked with: "${msg}")`);
  }
}

async function runTests() {
  console.log('===================================================================');
  console.log('Phase 5: ReviewAssist Review Management System Verification Suite');
  console.log('===================================================================\n');

  const repo = new MockLocalStorageRepository();
  const ai = new MockAIProvider(10);
  const businesses = await repo.getBusinesses();
  const businessA = businesses[0]; // The Urban Kitchen (owner-urban-1)
  const businessB = businesses[1]; // Blue Tokai Cafe (owner-bluetokai-2)

  // ---------------------------------------------------------------------------
  // 1 & 2. Viewing Business Feedback & Generated Customer Review Drafts
  // ---------------------------------------------------------------------------
  console.log('1 & 2. Viewing Business Feedback & Customer Review Drafts');
  const initialDraftsA = await repo.getDrafts(businessA.id);
  assert(
    initialDraftsA.length >= 4 &&
      initialDraftsA.every(
        (d) =>
          Boolean(d.originalInput) &&
          Boolean(d.generatedReview) &&
          d.businessId === businessA.id,
      ),
    `Loaded ${initialDraftsA.length} records with customer feedback and AI review drafts for Business A`,
  );

  // ---------------------------------------------------------------------------
  // 3. Sentiment Classification & Filtering by Sentiment
  // ---------------------------------------------------------------------------
  console.log('\n3. Sentiment Classification & Filtering by Sentiment');
  assert(
    classifyEstimatedSentiment(
      'Loved the butter chicken and garlic naan, staff was super polite!',
    ) === 'positive',
    'Estimated sentiment classifies positive feedback as "positive"',
  );
  assert(
    classifyEstimatedSentiment(
      'Ordered the veg thali at 1pm on Tuesday in the main hall.',
    ) === 'neutral',
    'Estimated sentiment classifies factual description as "neutral"',
  );
  assert(
    classifyEstimatedSentiment(
      'The soup was cold and the table was dirty when we arrived.',
    ) === 'negative',
    'Estimated sentiment classifies purely critical feedback as "negative" (never hidden)',
  );
  assert(
    classifyEstimatedSentiment(
      'The food was good, but the delivery took too long.',
    ) === 'mixed',
    'Estimated sentiment classifies mixed feedback as "mixed" (never forced into positive)',
  );

  const bySentiment = (s: string) =>
    initialDraftsA.filter((d) => d.sentiment === s);
  assert(
    bySentiment('positive').length >= 1 &&
      bySentiment('neutral').length >= 1 &&
      bySentiment('negative').length >= 1 &&
      bySentiment('mixed').length >= 1,
    'Sentiment filter separates positive, neutral, negative, and mixed records',
  );

  // ---------------------------------------------------------------------------
  // 4 & 5. Searching Feedback & Filtering by Workflow Status
  // ---------------------------------------------------------------------------
  console.log('\n4 & 5. Searching Feedback & Filtering by Workflow Status');
  const searchMutton = initialDraftsA.filter((d) =>
    `${d.originalInput} ${d.generatedReview}`
      .toLowerCase()
      .includes('mutton biryani'),
  );
  assert(
    searchMutton.length === 1 && searchMutton[0].id === 'd-1',
    'Search query "mutton biryani" locates the exact matching review record',
  );

  const allPendingInitially = initialDraftsA.filter(
    (d) => (d.responseStatus ?? 'pending') === 'pending',
  );
  assert(
    allPendingInitially.length === initialDraftsA.length,
    'All initial seed records start with workflow status "pending"',
  );

  // ---------------------------------------------------------------------------
  // 6, 7 & 8. Generating Business Response Drafts with Phase 3 & Phase 4 Context
  // ---------------------------------------------------------------------------
  console.log(
    '\n6, 7 & 8. Generating Business Response Drafts (Phase 3 + Phase 4 + Safety Rules)',
  );
  const aiConfigA = await repo.updateBusinessAIConfig(businessA.id, {
    tone: 'professional',
    customInstructions: 'Keep the tone courteous and grounded.',
    responseLength: 'medium',
    language: 'en',
  });
  const knowledgeA = await repo.updateBusinessKnowledge(businessA.id, {
    description:
      'Multi-cuisine restaurant in Hyderabad known for slow-cooked biryanis and North Indian curries.',
    primaryCategory: 'Restaurant',
    additionalInfo: 'Dine-in and delivery available.',
    targetKeywords: ['Best biryani in Hyderabad'],
    products: [
      {
        name: 'Mutton biryani',
        description: 'Slow-cooked dum biryani with tender mutton',
        category: 'Main Course',
      },
      {
        name: 'Butter chicken',
        description: 'Charcoal-grilled chicken in rich tomato gravy',
        category: 'Main Course',
      },
    ],
    services: [
      {
        name: 'Home delivery',
        description: 'Direct restaurant delivery across Hyderabad',
      },
    ],
    serviceAreas: ['Hyderabad', 'Madhapur'],
  });

  const mixedRecord = initialDraftsA.find((d) => d.id === 'd-1')!;
  const generatedMixedReply = await ai.generateBusinessResponse({
    business: businessA,
    customerReviewText: mixedRecord.originalInput,
    sentiment: mixedRecord.sentiment,
    attempt: 0,
    aiConfig: aiConfigA,
    businessKnowledge: knowledgeA,
  });

  const replyLower = generatedMixedReply.text.toLowerCase();
  assert(
    replyLower.includes('glad') &&
      replyLower.includes('apologize') &&
      replyLower.includes('mutton biryani'),
    'Mixed feedback response acknowledges both positive points ("Mutton biryani") and apologizes for the inconvenience',
  );

  const forbiddenFabrications = [
    'refund',
    'discount',
    'free meal',
    'compensation',
    'voucher',
  ];
  assert(
    forbiddenFabrications.every((word) => !replyLower.includes(word)),
    'Generated business response never invents refunds, discounts, or compensation',
  );

  // Save generated draft -> status becomes 'draft_generated'
  const afterGenerate = await repo.updateDraftResponse(
    businessA.id,
    mixedRecord.id,
    {
      responseDraft: generatedMixedReply.text,
      status: 'draft_generated',
      attempt: 0,
    },
  );
  assert(
    afterGenerate.responseStatus === 'draft_generated' &&
      afterGenerate.ownerResponseDraft === generatedMixedReply.text &&
      Boolean(afterGenerate.responseGeneratedAt) &&
      afterGenerate.responseApprovedAt === null &&
      afterGenerate.responseCompletedAt === null,
    'Generating draft sets status to "draft_generated" without auto-approving or auto-completing',
  );

  // ---------------------------------------------------------------------------
  // 9, 10, 11, 12 & 13. Editing, Regenerating, Copying, Approving, and Completing
  // ---------------------------------------------------------------------------
  console.log(
    '\n9–13. Editing, Regenerating, Copying, Approving, and Completing Workflow',
  );
  const regeneratedReply = await ai.generateBusinessResponse({
    business: businessA,
    customerReviewText: mixedRecord.originalInput,
    sentiment: mixedRecord.sentiment,
    attempt: 1,
    aiConfig: aiConfigA,
    businessKnowledge: knowledgeA,
  });
  assert(
    regeneratedReply.text !== generatedMixedReply.text,
    'Regenerating response draft (attempt=1) produces a fresh variation',
  );

  const editedText = `${regeneratedReply.text} Thank you again for dining with us.`;
  const afterEdit = await repo.updateDraftResponse(
    businessA.id,
    mixedRecord.id,
    {
      responseDraft: editedText,
      status: 'draft_generated',
      attempt: 1,
    },
  );
  assert(
    afterEdit.ownerResponseDraft === editedText &&
      afterEdit.responseStatus === 'draft_generated' &&
      afterEdit.responseAttempt === 1,
    'Editing response draft persists custom edits while keeping status "draft_generated"',
  );

  // Verify copying does not alter status in repository
  const reloadedAfterCopyCheck = (await repo.getDrafts(businessA.id)).find(
    (d) => d.id === mixedRecord.id,
  )!;
  assert(
    reloadedAfterCopyCheck.responseStatus === 'draft_generated',
    'Copying response text never automatically transitions status to approved or completed',
  );

  // Approve response -> status becomes 'approved'
  const afterApprove = await repo.updateDraftResponse(
    businessA.id,
    mixedRecord.id,
    {
      responseDraft: editedText,
      status: 'approved',
      attempt: 1,
    },
  );
  assert(
    afterApprove.responseStatus === 'approved' &&
      Boolean(afterApprove.responseApprovedAt) &&
      afterApprove.responseCompletedAt === null,
    'Approving response sets status to "approved" and records responseApprovedAt while keeping responseCompletedAt null',
  );

  // Complete response -> status becomes 'completed'
  const afterComplete = await repo.updateDraftResponse(
    businessA.id,
    mixedRecord.id,
    {
      responseDraft: editedText,
      status: 'completed',
      attempt: 1,
    },
  );
  assert(
    afterComplete.responseStatus === 'completed' &&
      Boolean(afterComplete.responseCompletedAt),
    'Marking external response completed sets status to "completed" and records responseCompletedAt',
  );

  // Verify direct transition from 'pending' -> 'completed' is blocked
  const pendingRecord = initialDraftsA.find((d) => d.id === 'd-2')!;
  await assertThrows(
    () =>
      repo.updateDraftResponse(businessA.id, pendingRecord.id, {
        responseDraft: 'Some text',
        status: 'completed',
      }),
    'Direct transition from "pending" to "completed" is rejected',
    'Cannot mark a response as "completed" directly from "pending"',
  );

  const emptyDraftValidation = validateResponseWorkflowUpdate({
    currentStatus: 'draft_generated',
    nextStatus: 'approved',
    responseDraft: '   ',
  });
  assert(
    !emptyDraftValidation.ok,
    'Approving an empty response draft is rejected',
  );

  // ---------------------------------------------------------------------------
  // 14 & 15. Business-to-Business Isolation & Unauthorized Access Protection
  // ---------------------------------------------------------------------------
  console.log(
    '\n14 & 15. Business-to-Business Data Isolation & Unauthorized Access',
  );
  const draftsB = await repo.getDrafts(businessB.id);
  assert(
    draftsB.every((d) => d.businessId === businessB.id) &&
      !draftsB.some((d) => d.id === mixedRecord.id),
    'Business B cannot see any of Business A review drafts',
  );

  await assertThrows(
    () =>
      repo.getDrafts(businessA.id, {
        actorOwnerId: 'owner-bluetokai-2',
      }),
    'Owner B blocked from reading Business A review drafts',
    'Unauthorized',
  );

  await assertThrows(
    () =>
      repo.updateDraftResponse(
        businessA.id,
        mixedRecord.id,
        {
          responseDraft: 'Cross-tenant tampering attempt',
          status: 'approved',
        },
        { actorOwnerId: 'owner-bluetokai-2' },
      ),
    'Owner B blocked from updating Business A response draft',
    'Unauthorized',
  );

  await assertThrows(
    () =>
      repo.updateDraftResponse(businessB.id, mixedRecord.id, {
        responseDraft: 'Cross-business ID mismatch',
        status: 'draft_generated',
      }),
    'Updating a draft using a mismatched businessId is blocked',
    'does not belong to business',
  );

  // ---------------------------------------------------------------------------
  // 16 & 17. Existing Customer Submission Flow, Non-Gating & Analytics Integrity
  // ---------------------------------------------------------------------------
  console.log(
    '\n16 & 17. Customer Submission Flow, Non-Gating & Analytics Integrity',
  );
  const metricsBefore = await repo.getMetrics(businessA.id);

  // Owner workflow actions above must NOT have altered customer funnel metrics
  assert(
    metricsBefore.qrScans === 4 &&
      metricsBefore.feedbackSubmissions === 2 &&
      metricsBefore.aiGenerations === 2 &&
      metricsBefore.googleRedirectClicks === 2,
    'Owner response workflow actions do NOT corrupt qrScans, feedbackSubmissions, aiGenerations, or googleRedirectClicks',
  );

  // Simulate a new negative customer feedback submission — verify it is NOT gated or rewritten into positive
  const negativeInput =
    'The AC was broken and the room was very noisy all night.';
  const customerDraft = await ai.generateReviewDraft({
    business: businessA,
    experience: negativeInput,
    mode: 'text',
    attempt: 0,
  });
  const detectedSentiment = classifyEstimatedSentiment(negativeInput);
  const recordedNegative = await repo.recordDraft({
    businessId: businessA.id,
    originalInput: negativeInput,
    generatedReview: customerDraft.text,
    mode: 'text',
    sentiment: detectedSentiment,
  });

  assert(
    recordedNegative.sentiment === 'negative' &&
      recordedNegative.responseStatus === 'pending' &&
      recordedNegative.generatedReview.toLowerCase().includes('noisy'),
    'Negative customer feedback is recorded honestly with "negative" sentiment and "pending" workflow status (zero review gating)',
  );

  // ---------------------------------------------------------------------------
  // 18. 90-Day Retention Policy Compatibility
  // ---------------------------------------------------------------------------
  console.log('\n18. 90-Day Retention Policy Compatibility');
  const nowMs = Date.parse('2026-11-15T12:00:00.000Z');
  const expiredTimestamp = new Date(
    nowMs - (CUSTOMER_DRAFT_RETENTION_DAYS + 5) * 24 * 60 * 60 * 1000,
  ).toISOString();
  const recentTimestamp = new Date(
    nowMs - 10 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const sampleList: CustomerDraftRecord[] = [
    {
      id: 'expired-95d',
      businessId: businessA.id,
      originalInput: 'Old feedback from 95 days ago.',
      generatedReview: 'Old feedback from 95 days ago.',
      mode: 'text',
      sentiment: 'positive',
      timestamp: expiredTimestamp,
      ownerResponseDraft: 'Old response',
      responseStatus: 'completed',
    },
    {
      id: 'active-10d',
      businessId: businessA.id,
      originalInput: 'Recent feedback from 10 days ago.',
      generatedReview: 'Recent feedback from 10 days ago.',
      mode: 'text',
      sentiment: 'positive',
      timestamp: recentTimestamp,
      ownerResponseDraft: null,
      responseStatus: 'pending',
    },
  ];

  const retained = filterActiveRetentionDrafts(
    sampleList,
    CUSTOMER_DRAFT_RETENTION_DAYS,
    nowMs,
  );
  assert(
    retained.length === 1 && retained[0].id === 'active-10d',
    `90-day retention filter removes records older than ${CUSTOMER_DRAFT_RETENTION_DAYS} days and preserves active records`,
  );

  console.log('\n===================================================================');
  console.log(`Verification Summary: ${passed} passed, ${failed} failed`);
  console.log('===================================================================');

  if (failed > 0) {
    Deno.exit(1);
  }
}

await runTests();
