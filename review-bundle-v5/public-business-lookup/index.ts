// ============================================================================
// Supabase Edge Function: public-business-lookup
// Path: supabase/functions/public-business-lookup/index.ts
//
// Security Responsibilities:
// 1. Trusted Client IP Source: Uses 'cf-connecting-ip' (set by Supabase's
//    Cloudflare edge proxy from the TCP socket peer and unspoofable by clients),
//    falling back to Deno.ServeHandlerInfo.remoteAddr in local development.
//    Never trusts client-spoofable x-forwarded-for or user-agent headers.
// 2. Global Per-Client Rate Limiting First: Consumes a rate-limit token via
//    public.consume_rate_limit() BEFORE reading/parsing the request body or
//    resolving slug, so malformed requests and invalid slugs cannot bypass
//    rate limits.
// 3. Streaming Byte Limit & Runtime Object Validation: Enforces max body size
//    (4 KB) while reading the stream (aborting immediately if exceeded) and
//    verifies the parsed JSON is a non-null, non-array plain object.
// 4. Server-Side RPC Only: Calls public.get_public_business_by_slug(p_slug)
//    via service_role and returns only public display columns (never owner_id).
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const FUNCTION_NAME = 'public-business-lookup';

// CORS: only origins listed in the ALLOWED_ORIGINS secret (comma-separated,
// exact match, e.g. "https://app.example.com,http://localhost:5173") receive
// Access-Control-Allow-Origin. Defaults to the local Vite dev server only.
// CORS limits browsers only; rate limiting remains the real abuse control.
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173')
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
const MAX_BODY_BYTES = 4096;
const LOOKUP_WINDOW_SECONDS = 3600;
const MAX_LOOKUPS_PER_HOUR = 30;

interface PublicBusinessRow {
  id: string;
  slug: string;
  name: string;
  category: 'restaurant' | 'cafe' | 'hotel' | 'pg';
  city: string;
  google_review_url: string;
  google_review_url_is_placeholder: boolean;
  created_at: string;
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

/**
 * Reads the request body stream with a strict byte limit so oversized payloads
 * are aborted before buffering into memory, then validates that the parsed JSON
 * is a non-null plain object.
 */
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

/**
 * Extracts the client IP from a verified infrastructure source:
 * 1. 'cf-connecting-ip' injected by Supabase's Cloudflare edge proxy.
 * 2. Direct socket remoteAddr (for local `supabase functions serve`).
 * Never trusts client-supplied x-forwarded-for or user-agent headers.
 */
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
  const clientHash = await computeClientFingerprintHash(req, info, 'lookup:global');
  const { data: allowed, error: rateErr } = await admin.rpc('consume_rate_limit', {
    p_scope_key: 'lookup:global',
    p_client_fingerprint_hash: clientHash,
    p_action_type: 'slug_lookup',
    p_business_id: null,
    p_window_seconds: LOOKUP_WINDOW_SECONDS,
    p_max_requests: MAX_LOOKUPS_PER_HOUR,
  });

  if (rateErr) {
    return jsonResponse({ error: 'Unable to process request' }, 500);
  }

  if (!allowed) {
    return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429);
  }

  // 2. Read stream with byte limit and validate non-null JSON object
  const bodyResult = await readJsonObjectWithByteLimit(req, MAX_BODY_BYTES);
  if (!bodyResult.ok) {
    return jsonResponse({ error: bodyResult.error }, bodyResult.status);
  }

  const cleanSlug =
    typeof bodyResult.data.slug === 'string'
      ? bodyResult.data.slug.trim().toLowerCase()
      : '';

  if (!SLUG_REGEX.test(cleanSlug)) {
    return jsonResponse({ error: 'Business not found' }, 404);
  }

  // 3. Server-side RPC call (executable only by service_role)
  const { data: rows, error: lookupErr } = await admin.rpc(
    'get_public_business_by_slug',
    { p_slug: cleanSlug },
  );

  if (lookupErr) {
    return jsonResponse({ error: 'Unable to load business' }, 500);
  }

  const row = Array.isArray(rows) ? (rows[0] as PublicBusinessRow | undefined) : undefined;
  if (!row) {
    return jsonResponse({ error: 'Business not found' }, 404);
  }

  // 4. Return public display fields only (never owner_id)
  return jsonResponse(
    {
      business: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        category: row.category,
        city: row.city,
        googleReviewUrl: row.google_review_url,
        googleReviewUrlIsPlaceholder: row.google_review_url_is_placeholder,
        createdAt: row.created_at,
      },
    },
    200,
  );
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