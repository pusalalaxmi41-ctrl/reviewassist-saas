// ============================================================================
// Supabase Edge Function: analyze-face-shape
// Modeled on JoshuaOliphant/face_shaper (Goodman's Barber Lounge + Headcurve)
// with multi-provider server-side Vision failover + privacy-first ephemeral
// handling (uploaded images are NEVER persisted in database or storage).
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0),
);

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const MAX_BODY_BYTES = 2_600_000; // ~2.5 MB JSON containing resized base64 JPEG
const WINDOW_SECONDS = 3600;
const MAX_ANALYSES_PER_HOUR = 20;

const FACE_SHAPES_PROMPT = `You are a master barber, hairstylist, and face shape analyzer.
Analyze the face shape in this photo. Determine gender presentation ("male" or "female") and match the face structure to these exact criteria:

MALE FACE SHAPES (7):
1. Oval — Longer than wide across cheekbones & forehead; forehead slightly wider than jawline; gently rounded jawline.
2. Square — Similar width and height; strong angular jawline rather than soft curves.
3. Heart — Forehead noticeably wider than jawline; narrower/tapered or pointed chin.
4. Round — Cheekbone width similar to face length; soft curved chin & fuller cheeks.
5. Triangle — Jawline wider than cheekbones; narrowest at forehead.
6. Oblong/Rectangle — Significantly longer than wide; similar width across forehead, cheekbones, and jawline.
7. Diamond — Angular face with cheekbones clearly the widest part; narrower forehead and jawline.

FEMALE FACE SHAPES (9):
1. Round 2. Oval 3. Inverted Triangle 4. Diamond 5. Triangle 6. Rectangle 7. Square 8. Heart 9. Oblong.

Return ONLY valid JSON matching this exact structure (no markdown fences):
{
  "gender": "male" | "female",
  "face_shape": "Exact face shape name",
  "confidence": 0.0 to 1.0,
  "characteristics": ["3-4 concise observed facial proportions"],
  "recommendations": ["3-4 specific modern hairstyle names & why each works"],
  "beard_pairing": "Concise beard/stubble or neckline advice (or hairline/framing tip for female)"
}

If the face is not clearly visible, return confidence <= 0.25 with clear photo tips.`;

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

function withCors(res: Response, req: Request): Response {
  res.headers.set('Vary', 'Origin');
  const origin = req.headers.get('origin');
  if (isAllowedOrigin(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      res.headers.set(k, v);
    }
  }
  return res;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function extractClientIp(req: Request, info: Deno.ServeHandlerInfo): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const remote = (info?.remoteAddr as { hostname?: string } | undefined)?.hostname;
  return remote || 'unknown';
}

async function hashFingerprint(ip: string, scope: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${scope}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseJsonSafe(rawText: string): Record<string, unknown> | null {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const inner = JSON.parse(match[0]);
        if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
          return inner as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function callAnthropicVision(
  apiKey: string,
  base64: string,
  mediaType: string,
): Promise<Record<string, unknown> | null> {
  const model = Deno.env.get('ANTHROPIC_MODEL')?.trim() || 'claude-3-5-sonnet-latest';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: FACE_SHAPES_PROMPT },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content?.find((c) => typeof c.text === 'string')?.text;
  return text ? parseJsonSafe(text) : null;
}

async function callOpenAiCompatibleVision(
  endpoint: string,
  apiKey: string,
  model: string,
  base64: string,
  mediaType: string,
): Promise<Record<string, unknown> | null> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: FACE_SHAPES_PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  return text ? parseJsonSafe(text) : null;
}

async function handleRequest(req: Request, info: Deno.ServeHandlerInfo): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Photo payload exceeds 2.5 MB limit' }, 413);
  }

  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Photo payload exceeds 2.5 MB limit' }, 413);
  }

  let body: { imageBase64?: unknown; mimeType?: unknown; preferredGender?: unknown };
  try {
    body = JSON.parse(rawText);
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body' }, 400);
  }

  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  const mimeType =
    typeof body.mimeType === 'string' &&
    /^image\/(jpeg|jpg|png|webp)$/i.test(body.mimeType.trim())
      ? body.mimeType.trim().toLowerCase().replace('image/jpg', 'image/jpeg')
      : 'image/jpeg';

  if (imageBase64.length < 100) {
    return jsonResponse({ error: 'A valid face photo is required' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (supabaseUrl && serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const fp = await hashFingerprint(extractClientIp(req, info), 'face_shaper:global');
    const { data: allowed } = await admin.rpc('consume_rate_limit', {
      p_scope_key: 'face_shaper:global',
      p_client_fingerprint_hash: fp,
      p_action_type: 'face_analysis',
      p_business_id: null,
      p_window_seconds: WINDOW_SECONDS,
      p_max_requests: MAX_ANALYSES_PER_HOUR,
    });
    if (allowed === false) {
      return jsonResponse(
        { error: 'Hourly scan limit reached. Please use manual proportion caliper or retry shortly.' },
        429,
      );
    }
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  const geminiKey = (Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEYS')?.split(/[\s,;]+/)[0])?.trim();
  const openAiKey = (Deno.env.get('OPENAI_API_KEY') || Deno.env.get('AI_API_KEY'))?.trim();
  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY')?.trim();

  if (anthropicKey) {
    const parsed = await callAnthropicVision(anthropicKey, imageBase64, mimeType);
    if (parsed) {
      return jsonResponse({ ...parsed, source: 'claude_vision' }, 200);
    }
  }

  if (geminiKey?.startsWith('AIza')) {
    const parsed = await callOpenAiCompatibleVision(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      geminiKey,
      Deno.env.get('GEMINI_MODEL')?.trim() || 'gemini-2.0-flash',
      imageBase64,
      mimeType,
    );
    if (parsed) {
      return jsonResponse({ ...parsed, source: 'gemini_vision' }, 200);
    }
  }

  if (openAiKey && !openAiKey.startsWith('gsk_')) {
    const parsed = await callOpenAiCompatibleVision(
      'https://api.openai.com/v1/chat/completions',
      openAiKey,
      Deno.env.get('OPENAI_MODEL')?.trim() || 'gpt-4o-mini',
      imageBase64,
      mimeType,
    );
    if (parsed) {
      return jsonResponse({ ...parsed, source: 'openai_vision' }, 200);
    }
  }

  if (openRouterKey) {
    const parsed = await callOpenAiCompatibleVision(
      'https://openrouter.ai/api/v1/chat/completions',
      openRouterKey,
      Deno.env.get('OPENROUTER_MODEL')?.trim() || 'openai/gpt-4o-mini',
      imageBase64,
      mimeType,
    );
    if (parsed) {
      return jsonResponse({ ...parsed, source: 'openrouter_vision' }, 200);
    }
  }

  return jsonResponse(
    { fallbackToLocal: true, reason: 'vision_key_unconfigured' },
    200,
  );
}

Deno.serve(async (req: Request, info: Deno.ServeHandlerInfo) => {
  try {
    const res = await handleRequest(req, info);
    return withCors(res, req);
  } catch {
    return withCors(jsonResponse({ fallbackToLocal: true, reason: 'edge_error' }, 200), req);
  }
});
