// ============================================================================
// Supabase Edge Function: admin-delete-account
// Path: supabase/functions/admin-delete-account/index.ts
//
// Security Responsibilities:
// 1. Verifies the caller's Bearer JWT via Supabase Auth, then verifies the
//    authenticated user exists in public.platform_admins before taking action.
// 2. Only this server-side Edge Function holds SUPABASE_SERVICE_ROLE_KEY.
// 3. Enforces global rate limiting (consume_rate_limit), 4 KB streaming body
//    limit, and runtime non-null plain JSON object validation.
// 4. Refuses to delete the caller's own admin account or any other user listed
//    in public.platform_admins.
// 5. Executes permanent deletion in the required order to satisfy
//    businesses_owner_id_fkey (ON DELETE RESTRICT):
//    - Deletes the business row(s) first (cascading analytics_events,
//      customer_drafts, and submission_rate_limits) and writes the plain-text
//      audit log entry via service_prepare_permanent_account_deletion().
//    - Calls admin.auth.admin.deleteUser(ownerId).
//    - If auth.admin.deleteUser() fails, immediately restores the snapshot via
//      service_rollback_permanent_account_deletion() so nothing is ever left
//      half-deleted.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const FUNCTION_NAME = 'admin-delete-account';

const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
);

const CORS_ALLOWED_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const MAX_BODY_BYTES = 4096;
const ADMIN_WINDOW_SECONDS = 3600;
const MAX_ADMIN_DELETES_PER_HOUR = 20;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BodyParseResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withCors(res: Response, req: Request): Response {
  res.headers.set('Vary', 'Origin');
  const origin = req.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    for (const [key, value] of Object.entries(CORS_ALLOWED_HEADERS)) {
      res.headers.set(key, value);
    }
  }
  return res;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const IPV4_REGEX =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_REGEX = /^[0-9a-f:.]{2,45}$/;

function isPlausibleIp(value: string): boolean {
  return IPV4_REGEX.test(value) || (value.includes(':') && IPV6_REGEX.test(value));
}

function extractTrustedClientIp(req: Request, info: Deno.ServeHandlerInfo): string {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim().toLowerCase();
  if (cfIp && isPlausibleIp(cfIp)) {
    return cfIp;
  }

  const addr = info.remoteAddr;
  if (addr && (addr.transport === 'tcp' || addr.transport === 'udp') && addr.hostname) {
    return addr.hostname;
  }

  return 'untrusted-unknown-ip';
}

async function computeClientFingerprintHash(
  req: Request,
  info: Deno.ServeHandlerInfo,
  scope: string,
): Promise<string> {
  const clientIp = extractTrustedClientIp(req, info);
  const raw = `v1|${clientIp}|${scope}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function readJsonObjectWithByteLimit(
  req: Request,
  maxBytes: number,
): Promise<BodyParseResult> {
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const declaredLength = Number(contentLengthHeader);
    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      return { ok: false, status: 400, error: 'Invalid Content-Length header' };
    }
    if (declaredLength > maxBytes) {
      return { ok: false, status: 413, error: 'Request payload too large' };
    }
  }

  if (!req.body) {
    return { ok: false, status: 400, error: 'Request body is required' };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          return { ok: false, status: 413, error: 'Request payload too large' };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { ok: false, status: 400, error: 'Unable to read request body' };
  }

  if (totalBytes === 0) {
    return { ok: false, status: 400, error: 'Request body is empty' };
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(merged);
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body' };
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      status: 400,
      error: 'Request body must be a non-null JSON object',
    };
  }

  return { ok: true, data: parsed };
}

async function handleRequest(
  req: Request,
  info: Deno.ServeHandlerInfo,
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Service temporarily unavailable' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Global rate limit BEFORE reading body
  const clientHash = await computeClientFingerprintHash(req, info, 'admin:delete');
  const { data: allowed, error: rateErr } = await admin.rpc('consume_rate_limit', {
    p_scope_key: 'admin:delete',
    p_client_fingerprint_hash: clientHash,
    p_action_type: 'admin_account_action',
    p_business_id: null,
    p_window_seconds: ADMIN_WINDOW_SECONDS,
    p_max_requests: MAX_ADMIN_DELETES_PER_HOUR,
  });

  if (rateErr) {
    return jsonResponse({ error: 'Unable to process request' }, 500);
  }

  if (!allowed) {
    return jsonResponse({ error: 'Rate limit exceeded. Please try again later.' }, 429);
  }

  // 2. Verify caller JWT and platform_admins membership
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  if (!token) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const {
    data: { user: caller },
    error: authErr,
  } = await admin.auth.getUser(token);

  if (authErr || !caller) {
    return jsonResponse({ error: 'Invalid or expired session token' }, 401);
  }

  const { data: adminRow, error: adminCheckErr } = await admin
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', caller.id)
    .maybeSingle();

  if (adminCheckErr || !adminRow) {
    return jsonResponse({ error: 'Forbidden: platform administrator access required' }, 403);
  }

  // 3. Parse and validate JSON body with 4 KB byte cap
  const bodyResult = await readJsonObjectWithByteLimit(req, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return jsonResponse({ error: bodyResult.error }, bodyResult.status);
  }

  const payload = bodyResult.data;

  // Support daily scheduled sweep when invoked with { mode: "scheduled_sweep" }
  if (payload.mode === 'scheduled_sweep') {
    const { data: purgedCount, error: sweepErr } = await admin.rpc(
      'purge_expired_pending_deletion_accounts',
      { p_batch_limit: 100 },
    );

    if (sweepErr) {
      console.error(JSON.stringify({ fn: FUNCTION_NAME, event: 'sweep_failed' }));
      return jsonResponse({ error: 'Scheduled account purge failed' }, 500);
    }

    return jsonResponse({ purgedCount: Number(purgedCount ?? 0) }, 200);
  }

  const businessId =
    typeof payload.businessId === 'string' ? payload.businessId.trim() : '';
  const confirmationBusinessName =
    typeof payload.confirmationBusinessName === 'string'
      ? payload.confirmationBusinessName.trim()
      : '';
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';

  if (!UUID_REGEX.test(businessId)) {
    return jsonResponse({ error: 'Valid businessId UUID is required' }, 400);
  }

  if (!confirmationBusinessName) {
    return jsonResponse(
      { error: 'Please type the exact business name to confirm permanent deletion.' },
      400,
    );
  }

  if (reason.length < 3 || reason.length > 500) {
    return jsonResponse(
      { error: 'A deletion reason between 3 and 500 characters is required.' },
      400,
    );
  }

  // 4. Pre-verify target business & owner before deleting any rows
  const { data: targetBiz, error: targetErr } = await admin
    .from('businesses')
    .select('id, owner_id, name')
    .eq('id', businessId)
    .maybeSingle();

  if (targetErr || !targetBiz) {
    return jsonResponse({ error: 'Business not found' }, 404);
  }

  if (targetBiz.owner_id === caller.id) {
    return jsonResponse(
      { error: 'Cannot delete your own platform administrator account.' },
      403,
    );
  }

  const { data: targetIsAdmin } = await admin
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', targetBiz.owner_id)
    .maybeSingle();

  if (targetIsAdmin) {
    return jsonResponse(
      { error: 'Cannot delete another platform administrator account.' },
      403,
    );
  }

  if (confirmationBusinessName !== targetBiz.name) {
    return jsonResponse(
      { error: `Confirmation name must exactly match "${targetBiz.name}".` },
      400,
    );
  }

  // Verify GoTrue Admin API can read the target user before touching database rows
  const { data: authUserCheck, error: getUserErr } =
    await admin.auth.admin.getUserById(targetBiz.owner_id);
  if (getUserErr || !authUserCheck?.user) {
    return jsonResponse(
      { error: 'Unable to verify target auth user before deletion.' },
      500,
    );
  }

  // 5. Delete business data first (cascades child tables, satisfies ON DELETE RESTRICT)
  //    and record plain-text audit log entry.
  const { data: prepData, error: prepErr } = await admin.rpc(
    'service_prepare_permanent_account_deletion',
    {
      p_business_id: businessId,
      p_caller_admin_id: caller.id,
      p_confirmation_name: confirmationBusinessName,
      p_reason: reason,
    },
  );

  if (prepErr || !prepData || typeof prepData !== 'object') {
    console.error(
      JSON.stringify({
        fn: FUNCTION_NAME,
        event: 'prepare_delete_failed',
        businessId,
      }),
    );
    return jsonResponse(
      { error: prepErr?.message || 'Unable to delete business records.' },
      400,
    );
  }

  const ownerId = String((prepData as Record<string, unknown>).ownerId ?? '');

  // 6. Delete the Supabase Auth user now that ON DELETE RESTRICT is cleared.
  const { error: deleteUserErr } = await admin.auth.admin.deleteUser(ownerId);

  if (deleteUserErr) {
    // Compensating rollback so the account is never left half-deleted
    await admin.rpc('service_rollback_permanent_account_deletion', {
      p_snapshot: prepData,
      p_error_detail: deleteUserErr.message,
    });

    console.error(
      JSON.stringify({
        fn: FUNCTION_NAME,
        event: 'auth_delete_failed_rolled_back',
        businessId,
      }),
    );

    return jsonResponse(
      {
        error:
          'Auth user deletion failed; business records were safely rolled back so nothing was left half-deleted.',
      },
      500,
    );
  }

  return jsonResponse(
    {
      deleted: true,
      businessId,
      businessName: targetBiz.name,
      ownerId,
    },
    200,
  );
}

Deno.serve(async (req: Request, info: Deno.ServeHandlerInfo) => {
  let res: Response;
  try {
    res = await handleRequest(req, info);
  } catch {
    res = jsonResponse({ error: 'Unable to process request' }, 500);
  }
  return withCors(res, req);
});
