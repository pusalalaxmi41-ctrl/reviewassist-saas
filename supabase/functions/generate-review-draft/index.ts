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
// 6. Server-Side AI Secret + Optional Real SSE Streaming:
//    Reads AI_API_KEY / GROQ_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY from
//    server-side Deno.env secrets only. If configured and stream=true, streams
//    SSE tokens ('text/event-stream') and records the completed draft. If no
//    server AI secret is set, falls back to deterministic grammar cleanup and
//    returns { text, streamed: false, generationSource: 'deterministic_fallback' }.
// 7. Atomic Database Recording: Calls public.record_customer_draft_with_events()
//    so customer_drafts insertion and analytics_events insertion execute inside
//    a single PostgreSQL transaction.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const FUNCTION_NAME = 'generate-review-draft';

const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
);

const CORS_ALLOWED_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const LOG_IP_SOURCE = Deno.env.get('LOG_IP_SOURCE') === 'true';

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow Vercel production/preview deployments over HTTPS out of the box
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

function withCors(res: Response, req: Request): Response {
  res.headers.set('Vary', 'Origin');
  const origin = req.headers.get('origin');
  if (isAllowedOrigin(origin)) {
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

const SYSTEM_PROMPT = `You transform a customer's genuine feedback into a natural, readable Google review.

STRICT QUALITY & INTEGRITY RULES:
1. Correct grammar and improve readability while keeping the customer's natural voice.
2. Preserve the customer's exact meaning, actual experience, and original sentiment.
3. Avoid unnecessary exaggeration, flowery marketing language, or robotic AI clichés.
4. NEVER invent products, dishes, rooms, amenities, or services the customer did not mention.
5. NEVER turn negative or mixed feedback into positive feedback, and NEVER automatically write a five-star glowing review if the customer expressed criticism.
6. NEVER add business keywords that the customer did not mention.
7. Output ONLY the review text itself (no surrounding quotes, titles, or commentary).`;

interface PublicBusinessRow {
  id: string;
  slug: string;
  name: string;
  category: string;
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
    .replace(/\bim\b/gi, "I'm")
    .replace(/\bdont\b/gi, "don't")
    .replace(/\bdidnt\b/gi, "didn't")
    .replace(/\bwasnt\b/gi, "wasn't")
    .replace(/\bcant\b/gi, "can't")
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
    '',
    `Sharing my experience at ${businessName}.`,
    `Visited ${businessName} recently.`,
  ];
  const opener = openers[Math.abs(attempt) % openers.length];
  return [opener, ...sentences].filter(Boolean).join(' ');
}

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

interface AiProviderConfig {
  provider: 'groq' | 'openrouter' | 'gemini' | 'openai';
  endpoint: string;
  apiKey: string;
  model: string;
}

const keyCooldownUntil = new Map<string, number>();
let roundRobinCursor = 0;

function buildProviderConfig(rawKey: string): AiProviderConfig {
  const globalModel = Deno.env.get('AI_MODEL')?.trim();

  if (rawKey.startsWith('gsk_')) {
    return {
      provider: 'groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: rawKey,
      model: Deno.env.get('GROQ_MODEL')?.trim() || globalModel || 'llama-3.3-70b-versatile',
    };
  }
  if (rawKey.startsWith('sk-or-')) {
    return {
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: rawKey,
      model: Deno.env.get('OPENROUTER_MODEL')?.trim() || globalModel || 'openai/gpt-4o-mini',
    };
  }
  if (rawKey.startsWith('AIza')) {
    return {
      provider: 'gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: rawKey,
      model: Deno.env.get('GEMINI_MODEL')?.trim() || globalModel || 'gemini-2.0-flash',
    };
  }
  return {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: rawKey,
    model: Deno.env.get('OPENAI_MODEL')?.trim() || globalModel || 'gpt-4o-mini',
  };
}

function resolveServerAiPool(): AiProviderConfig[] {
  const envSources = [
    Deno.env.get('AI_API_KEYS'),
    Deno.env.get('GROQ_API_KEYS'),
    Deno.env.get('OPENROUTER_API_KEYS'),
    Deno.env.get('GEMINI_API_KEYS'),
    Deno.env.get('OPENAI_API_KEYS'),
    Deno.env.get('AI_API_KEY'),
    Deno.env.get('GROQ_API_KEY'),
    Deno.env.get('OPENROUTER_API_KEY'),
    Deno.env.get('GEMINI_API_KEY'),
    Deno.env.get('OPENAI_API_KEY'),
  ];

  const seen = new Set<string>();
  const keys: string[] = [];

  for (const raw of envSources) {
    if (!raw) continue;
    for (const part of raw.split(/[\s,;]+/)) {
      const cleaned = part.trim();
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        keys.push(cleaned);
      }
    }
  }

  return keys.map(buildProviderConfig);
}

function getOrderedActivePool(pool: AiProviderConfig[]): AiProviderConfig[] {
  if (pool.length === 0) return [];
  const now = Date.now();
  const start = roundRobinCursor % pool.length;
  roundRobinCursor = (roundRobinCursor + 1) % pool.length;

  const rotated = [...pool.slice(start), ...pool.slice(0, start)];
  const ready = rotated.filter((cfg) => (keyCooldownUntil.get(cfg.apiKey) ?? 0) <= now);
  const cooling = rotated.filter((cfg) => (keyCooldownUntil.get(cfg.apiKey) ?? 0) > now);
  return [...ready, ...cooling];
}

function markKeyCooldown(apiKey: string, status: number): void {
  // 401/402/403 = invalid or out-of-credits key -> cool down 1 hour
  // 429/5xx = rate limited or transient upstream error -> cool down 5 minutes
  const durationMs = status === 401 || status === 402 || status === 403 ? 3600_000 : 300_000;
  keyCooldownUntil.set(apiKey, Date.now() + durationMs);
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
  const wantsStream = payload.stream === true;

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

  const sentiment = detectSentiment(experience);
  const aiPool = resolveServerAiPool();

  // 5A. If server-side AI pool is configured, rotate keys with automatic failover
  if (aiPool.length > 0) {
    const userPrompt = `Business: ${business.name} (${business.category || 'local business'})
Detected customer sentiment: ${sentiment}
Variation attempt: ${attempt + 1}
Customer's actual feedback: "${experience}"

Rewrite this into a clear, natural, human-sounding review that stays 100% faithful to the customer's words and sentiment:`;

    const orderedCandidates = getOrderedActivePool(aiPool).slice(0, Math.min(aiPool.length, 6));

    for (const aiConfig of orderedCandidates) {
      try {
        const upstreamRes = await fetch(aiConfig.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aiConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: aiConfig.model,
            temperature: 0.65,
            max_tokens: 350,
            stream: wantsStream,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
          }),
        });

        if (!upstreamRes.ok) {
          markKeyCooldown(aiConfig.apiKey, upstreamRes.status);
          continue;
        }

        if (wantsStream && upstreamRes.body) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          const upstreamReader = upstreamRes.body.getReader();

          const stream = new ReadableStream({
            async start(controller) {
              let buffer = '';
              let fullText = '';

              try {
                while (true) {
                  const { done, value } = await upstreamReader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });

                  const lines = buffer.split('\n');
                  buffer = lines.pop() ?? '';

                  for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line.startsWith('data:')) continue;
                    const dataPayload = line.slice(5).trim();
                    if (!dataPayload || dataPayload === '[DONE]') continue;

                    try {
                      const parsed = JSON.parse(dataPayload) as {
                        choices?: Array<{ delta?: { content?: string } }>;
                      };
                      const delta = parsed.choices?.[0]?.delta?.content ?? '';
                      if (delta) {
                        fullText += delta;
                        controller.enqueue(
                          encoder.encode(`data: ${JSON.stringify({ token: delta })}\n\n`),
                        );
                      }
                    } catch {
                      // ignore partial chunk parse errors
                    }
                  }
                }

                const finalReview =
                  fullText.trim() || buildReviewDraft(business.name, experience, attempt);

                await admin.rpc('record_customer_draft_with_events', {
                  p_business_id: business.id,
                  p_original_input: experience,
                  p_generated_review: finalReview,
                  p_mode: mode,
                  p_sentiment: sentiment,
                  p_attempt: attempt,
                });

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: finalReview })}\n\n`),
                );
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              } catch {
                controller.error(new Error('Stream interrupted'));
              } finally {
                upstreamReader.releaseLock();
              }
            },
          });

          return new Response(stream, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              Connection: 'keep-alive',
            },
          });
        }

        if (!wantsStream) {
          const jsonBody = (await upstreamRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const aiText = jsonBody.choices?.[0]?.message?.content?.trim();
          if (aiText) {
            const { error: recordErr } = await admin.rpc('record_customer_draft_with_events', {
              p_business_id: business.id,
              p_original_input: experience,
              p_generated_review: aiText,
              p_mode: mode,
              p_sentiment: sentiment,
              p_attempt: attempt,
            });
            if (recordErr) {
              return jsonResponse({ error: 'Unable to save review draft' }, 500);
            }
            return jsonResponse(
              {
                text: aiText,
                streamed: false,
                generationSource: aiConfig.provider,
              },
              200,
            );
          }
        }
      } catch {
        markKeyCooldown(aiConfig.apiKey, 503);
      }
    }
  }

  // 5B. Deterministic server-side review draft synthesis strictly from customer words
  const generatedReview = buildReviewDraft(business.name, experience, attempt);

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

  return jsonResponse(
    {
      text: generatedReview,
      streamed: false,
      generationSource: 'deterministic_fallback',
    },
    200,
  );
}

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
