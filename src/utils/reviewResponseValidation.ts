import {
  CUSTOMER_DRAFT_RETENTION_DAYS,
  type CustomerDraftRecord,
  type ResponseWorkflowStatus,
} from '../types/business';

export const VALID_RESPONSE_WORKFLOW_STATUSES: ReadonlyArray<ResponseWorkflowStatus> = [
  'pending',
  'draft_generated',
  'approved',
  'completed',
];

export const OWNER_RESPONSE_MAX_LENGTH = 4000;

export function isValidResponseWorkflowStatus(
  value: unknown,
): value is ResponseWorkflowStatus {
  return (
    typeof value === 'string' &&
    (VALID_RESPONSE_WORKFLOW_STATUSES as ReadonlyArray<string>).includes(value)
  );
}

/**
 * Validates that a business-owner response draft is non-empty and within bounds,
 * and checks that workflow transitions follow the required lifecycle rules:
 * - 'pending' -> 'draft_generated' -> 'approved' -> 'completed'
 * - 'completed' cannot be set without a non-empty response draft and an approved or active draft state.
 */
export function validateResponseWorkflowUpdate(input: {
  currentStatus: ResponseWorkflowStatus;
  nextStatus: ResponseWorkflowStatus;
  responseDraft: string | null | undefined;
}): { ok: true; cleanedDraft: string | null } | { ok: false; error: string } {
  if (!isValidResponseWorkflowStatus(input.nextStatus)) {
    return {
      ok: false,
      error: `Invalid response workflow status "${String(input.nextStatus)}".`,
    };
  }

  const rawDraft =
    input.responseDraft === undefined || input.responseDraft === null
      ? ''
      : String(input.responseDraft).trim();

  if (input.nextStatus === 'pending') {
    return { ok: true, cleanedDraft: null };
  }

  if (!rawDraft) {
    return {
      ok: false,
      error: `A non-empty business response draft is required before setting status to "${input.nextStatus}".`,
    };
  }

  if (rawDraft.length > OWNER_RESPONSE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Business response draft must be ${OWNER_RESPONSE_MAX_LENGTH} characters or fewer (currently ${rawDraft.length}).`,
    };
  }

  if (
    input.nextStatus === 'completed' &&
    input.currentStatus === 'pending'
  ) {
    return {
      ok: false,
      error:
        'Cannot mark a response as "completed" directly from "pending". Generate and review the response draft first.',
    };
  }

  return { ok: true, cleanedDraft: rawDraft };
}

/**
 * Checks whether a customer draft record is within the approved 90-day retention window.
 */
export function isWithinRetentionWindow(
  recordTimestamp: string,
  retentionDays = CUSTOMER_DRAFT_RETENTION_DAYS,
  nowMs = Date.now(),
): boolean {
  const createdMs = Date.parse(recordTimestamp);
  if (!Number.isFinite(createdMs)) {
    return true;
  }
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  return nowMs - createdMs <= maxAgeMs;
}

export function filterActiveRetentionDrafts(
  drafts: CustomerDraftRecord[],
  retentionDays = CUSTOMER_DRAFT_RETENTION_DAYS,
  nowMs = Date.now(),
): CustomerDraftRecord[] {
  return drafts.filter((d) =>
    isWithinRetentionWindow(d.timestamp, retentionDays, nowMs),
  );
}
