// ============================================================================
// Supabase Edge Function: generate-review-draft
// Path: supabase/functions/generate-review-draft/index.ts
//
// Security Responsibilities:
// 1. Trusted Client IP Source: Uses 'cf-connecting-ip' from Supabase's
//    Cloudflare edge proxy (or socket remoteAddr locally). Never trusts
//    client-spoofable x-forwarded-for or user-agent headers.
// 2. Two-Tier Rate Limiting:
//    - Tier 1 (Global per-client): Enforced BEFORE reading body or resolving
//      slug so malformed requests or invalid slugs cannot flood the function.
//    - Tier 2 (Per-business per-client): Enforced AFTER resolving slug (max 5
//      drafts/hour per business).
// 3. Streaming Byte Limit & Runtime Object Validation: Aborts immediately if
//    request stream exceeds 8 KB and rejects null, arrays, or primitives.
// 4. Server-Side Slug Resolution: Resolves business exclusively from { slug }
//    via get_public_business_by_slug(). Client cannot supply businessId.
// 5. Accurate 3-Way Sentiment Classification ('positive' | 'neutral' | 'mixed'):
//    Distinguishes positive praise, constructive criticism/mixed feedback,
//    and factual neutral descriptions (without mislabeling neutral inputs as
//    positive).
// 6. Atomic Database Recording: Calls public.record_customer_draft_with_events()
//    so customer_drafts insertion and analytics_events insertion execute inside
//    a single PostgreSQL transaction.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const FUNCTION_NAME = 'generate-review-draft';

// CORS: only origins listed in the ALLOWED_ORIGINS secret (comma-separated,
// exact match, e.g. "https://app.example.com,http://localhost:5173") receive
// Access-Control-Allow-Origin. Defaults to the local Vite dev server only.
// CORS limits browsers only; rate limiting remains the real abuse control.
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

// Opt-in staging diagnostic (LOG_IP_SOURCE=true): logs WHICH source produced
// the client IP and whether forwarding headers were present — never the
// IP address or header values.
const LOG_IP_SOURCE = Deno.env.get('LOG_IP_SOURCE') === 'true';

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

const SLUG_REGEX = /^[a-z0-9-]{3,80}$/;
const MAX_BODY_BYTES = 8192;
const EXPERIENCE_MIN = 20;
const EXPERIENCE_MAX = 2000;
const DRAFT_WINDOW_SECONDS = 3600;
const MAX_GLOBAL_DRAFT_REQUESTS_PER_HOUR = 15;
const MAX_DRAFTS_PER_BUSINESS_HOUR = 5;
const FILLERS = /\b(?:um+|uh+|erm+|hmm+)\b,?\s*/gi;

const NEGATED_POSITIVE_PATTERN =
  /\b(?:not|never|hardly|barely|no)\s+(?:good|great|clean|fresh|friendly|polite|courteous|tasty|delicious|helpful|comfortable|quick|fast|worth|nice|pleasant|warm|recommended)\b/i;

const CRITICISM_PATTERN =
  /\b(?:slow|waited|waiting|cold|bad|noisy|loud|expensive|overpriced|delay|delayed|issue|issues|problem|problems|rude|unfriendly|dirty|unclean|unhygienic|stale|bland|salty|oily|greasy|undercooked|overcooked|burnt|raw|poor|worst|disappointed|disappointing|mediocre|late|broken|cramped|crowded|smelly|flies|mosquitoes|bugs|hair|leak|leaking|terrible|horrible|awful|lacking|underwhelming)\b|\bnot\s+working\b/i;

const POSITIVE_PATTERN =
  /\b(?:great|good|tasty|delicious|fresh|loved|love|excellent|friendly|clean|spotless|polite|courteous|nice|best|recommend|recommended|amazing|wonderful|flavourful|flavorful|comfortable|cozy|quick|fast|prompt|awesome|pleasant|helpful|fantastic|superb|happy|satisfied|welcoming|authentic|generous|affordable|value)\b/i;

interface PublicBusinessRow {
  id: string;
  slug: string;
  name: string;
}

type BodyParseResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const IPV4_REGEX =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_REGEX = /^[0-9a-f:.]{2,45}$/;

/** Accepts only syntactically valid IPv4 / IPv6 literals (rejects junk header values). */
function isPlausibleIp(value: string): boolean {
  return IPV4_REGEX.test(value) || (value.includes(':') && IPV6_REGEX.test(value));
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

type ClientIpSource = 'cf-connecting-ip' | 'remote-addr' | 'unknown';

function resolveClientIp(
  req: Request,
  info: Deno.ServeHandlerInfo,
): { ip: string; source: ClientIpSource } {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim().toLowerCase();
  if (cfIp && isPlausibleIp(cfIp)) {
    return { ip: cfIp, source: 'cf-connecting-ip' };
  }

  const addr = info.remoteAddr;
  if (addr && (addr.transport === 'tcp' || addr.transport === 'udp') && addr.hostname) {
    return { ip: addr.hostname, source: 'remote-addr' };
  }

  return { ip: 'untrusted-unknown-ip', source: 'unknown' };
}

function extractTrustedClientIp(req: Request, info: Deno.ServeHandlerInfo): string {
  return resolveClientIp(req, info).ip;
}

function logIpSource(req: Request, info: Deno.ServeHandlerInfo): void {
  const cfHeader = req.headers.get('cf-connecting-ip');
  console.log(JSON.stringify({
    event: 'ip_source_diagnostic',
    fn: FUNCTION_NAME,
    source: resolveClientIp(req, info).source,
    cf_connecting_ip_present: cfHeader !== null,
    cf_connecting_ip_valid: cfHeader !== null && isPlausibleIp(cfHeader.trim().toLowerCase()),
    x_forwarded_for_present: req.headers.has('x-forwarded-for'),
    x_real_ip_present: req.headers.has('x-real-ip'),
  }));
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

function toSentences(input: string): string[] {
  const cleaned = input
    .replace(FILLERS, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\bi\b/g, 'I')
    .replace(/\b[A-Z]{4,}\b/g, (w) => w.toLowerCase())
    .replace(/([!?])\1+/g, '$1')
    .trim();

  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const capped = s.charAt(0).toUpperCase() + s.slice(1);
      return /[.!?]$/.test(capped) ? capped : `${capped}.`;
    });
}

function buildReviewDraft(businessName: string, experience: string, attempt: number): string {
  const sentences = toSentences(experience);
  const openers = [
    `Here is my honest experience at ${businessName}.`,
    '',
    `A few thoughts on ${businessName}.`,
  ];
  const opener = openers[Math.abs(attempt) % openers.length];
  return [opener, ...sentences].filter(Boolean).join(' ');
}

/**
 * Classifies customer experience into 'positive', 'neutral', or 'mixed':
 * - Strips negated positive phrases (e.g. "not good", "not clean") first and
 *   counts them as criticism so they do not trigger false positive matches.
 * - If any criticism/negative indicator is present -> 'mixed' (constructive
 *   or critical feedback preserved).
 * - Else if positive praise indicators are present -> 'positive'.
 * - Otherwise -> 'neutral' (factual descriptions without praise or criticism).
 */
function detectSentiment(text: string): 'positive' | 'neutral' | 'mixed' {
  const hasNegatedPositive = NEGATED_POSITIVE_PATTERN.test(text);
  const textWithoutNegatedPositives = text.replace(
    new RegExp(NEGATED_POSITIVE_PATTERN.source, 'gi'),
    ' ',
  );

  const hasCriticism = hasNegatedPositive || CRITICISM_PATTERN.test(text);
  const hasPositive = POSITIVE_PATTERN.test(textWithoutNegatedPositives);

  if (hasCriticism) {
    return 'mixed';
  }
  if (hasPositive) {
    return 'positive';
  }
  return 'neutral';
}

async function handleRequest(req: Request, info: Deno.ServeHandlerInfo): Promise<Response> {
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

  // 1. Global per-client rate limit BEFORE reading body or resolving slug.
  const globalClientHash = await computeClientFingerprintHash(req, info, 'draft:global');
  const { data: globalAllowed, error: globalRateErr } = await admin.rpc('consume_rate_limit', {
    p_scope_key: 'draft:global',
    p_client_fingerprint_hash: globalClientHash,
    p_action_type: 'draft_generation',
    p_business_id: null,
    p_window_seconds: DRAFT_WINDOW_SECONDS,
    p_max_requests: MAX_GLOBAL_DRAFT_REQUESTS_PER_HOUR,
  });

  if (globalRateErr) {
    return jsonResponse({ error: 'Unable to process request' }, 500);
  }

  if (!globalAllowed) {
    return jsonResponse(
      { error: 'Too many review drafts generated recently. Please wait and try again.' },
      429,
    );
  }

  // 2. Read stream with 8 KB byte limit and validate non-null JSON object
  const bodyResult = await readJsonObjectWithByteLimit(req, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return jsonResponse({ error: bodyResult.error }, bodyResult.status);
  }

  const payload = bodyResult.data;
  const cleanSlug =
    typeof payload.slug === 'string' ? payload.slug.trim().toLowerCase() : '';
  const experience =
    typeof payload.experience === 'string' ? payload.experience.trim() : '';
  const mode =
    payload.mode === 'voice' ? 'voice' : payload.mode === 'text' ? 'text' : null;
  const attempt =
    typeof payload.attempt === 'number' &&
    Number.isInteger(payload.attempt) &&
    payload.attempt >= 0
      ? Math.min(payload.attempt, 10)
      : 0;

  if (!SLUG_REGEX.test(cleanSlug)) {
    return jsonResponse({ error: 'Invalid business slug' }, 400);
  }

  if (experience.length < EXPERIENCE_MIN || experience.length > EXPERIENCE_MAX) {
    return jsonResponse(
      { error: `Experience must be between ${EXPERIENCE_MIN} and ${EXPERIENCE_MAX} characters.` },
      400,
    );
  }

  if (!mode) {
    return jsonResponse({ error: 'Invalid input mode' }, 400);
  }

  // 3. Server-side slug-to-business resolution via service_role RPC
  const { data: rows, error: lookupErr } = await admin.rpc(
    'get_public_business_by_slug',
    { p_slug: cleanSlug },
  );

  if (lookupErr) {
    return jsonResponse({ error: 'Unable to process request' }, 500);
  }

  const business = Array.isArray(rows)
    ? (rows[0] as PublicBusinessRow | undefined)
    : undefined;
  if (!business) {
    return jsonResponse({ error: 'Business not found' }, 404);
  }

  // 4. Per-business atomic rate limit check + insert in PostgreSQL
  const scopeKey = `biz:${business.id}`;
  const bizClientHash = await computeClientFingerprintHash(req, info, scopeKey);

  const { data: bizAllowed, error: bizRateErr } = await admin.rpc('consume_rate_limit', {
    p_scope_key: scopeKey,
    p_client_fingerprint_hash: bizClientHash,
    p_action_type: 'draft_generation',
    p_business_id: business.id,
    p_window_seconds: DRAFT_WINDOW_SECONDS,
    p_max_requests: MAX_DRAFTS_PER_BUSINESS_HOUR,
  });

  if (bizRateErr) {
    return jsonResponse({ error: 'Unable to process request' }, 500);
  }

  if (!bizAllowed) {
    return jsonResponse(
      { error: 'Too many review drafts generated recently. Please wait and try again.' },
      429,
    );
  }

  // 5. Synthesize review draft strictly from customer words
  const generatedReview = buildReviewDraft(business.name, experience, attempt);
  const sentiment = detectSentiment(experience);

  // 6. Atomically record customer_drafts + analytics_events in one DB transaction
  const { error: recordErr } = await admin.rpc(
    'record_customer_draft_with_events',
    {
      p_business_id: business.id,
      p_original_input: experience,
      p_generated_review: generatedReview,
      p_mode: mode,
      p_sentiment: sentiment,
      p_attempt: attempt,
    },
  );

  if (recordErr) {
    return jsonResponse({ error: 'Unable to save review draft' }, 500);
  }

  return jsonResponse({ text: generatedReview }, 200);
}

// Top-level guard: any unexpected exception returns a generic 500 so stack
// traces, SQL errors, or internal details never reach the client.
Deno.serve(async (req: Request, info: Deno.ServeHandlerInfo) => {
  if (LOG_IP_SOURCE && req.method !== 'OPTIONS') {
    logIpSource(req, info);
  }

  let res: Response;
  try {
    res = await handleRequest(req, info);
  } catch {
    res = jsonResponse({ error: 'Unable to process request' }, 500);
  }
  return withCors(res, req);
});