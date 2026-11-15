# ReviewAssist v1.0

> **"Making customer feedback simple for people and meaningful for businesses."**

ReviewAssist is a multi-tenant hospitality & local-business customer feedback and review management SaaS platform built for **restaurants, cafes, hotels, and PG accommodations**.

---

## Architecture & Completed Phases

### 1. Customer-Facing Review Experience (`/r/:businessSlug`) — Phase 1
- **Mobile-First, Distraction-Free Flow**: Customers scan a table or reception QR code to open `/r/:businessSlug`.
- **Text & Browser Voice-to-Text Input**: Supports typed notes, category-specific quick highlight pills, and browser Web Speech API voice-to-text (no audio is ever uploaded or stored).
- **Live AI Draft Generation**:
  - Connects to the `generate-review-draft` Supabase Edge Function (with automatic SSE streaming when supported, or character-by-character typewriter reveal in `DM Sans` with `prefers-reduced-motion` support).
  - Strictly preserves customer honesty: negative, mixed, neutral, and positive experiences are reflected faithfully without review gating or fabricated praise.
- **Customer Control & Google Hand-Off**: Customers can edit any word, regenerate variations, copy to clipboard, and open the business's official Google Review page.

### 2. Professional QR Code & Print Studio (`/dashboard?tab=qr`) — Phase 2
- **Three Print-Ready Templates**:
  - `Minimal Google Review Card`
  - `Business Branded Card`
  - `Table / Counter Standee`
- **High-Contrast Print Presets**: Forest Green (`#244B40`), Charcoal (`#252B29`), Deep Navy (`#1E293B`), Royal Indigo (`#312E81`), and Classic Black (`#0F172A`) on a pure white QR quiet zone (`margin >= 4`, Error Correction Level `M`).
- **Exports**: High-resolution `1200×1700 px` PNG download, zero-dependency printable A5 PDF export (`%PDF-1.4`), direct browser print standee, and pre-formatted WhatsApp sharing links.

### 3. Per-Business AI Configuration (`/dashboard?tab=settings`) — Phase 3
- **Independent Multi-Tenant Settings**:
  - **Communication Tone**: `friendly`, `professional`, `formal`, `warm_and_welcoming`, `conversational`, `premium`, `short_and_direct`
  - **Response Length**: `short`, `medium`, `long`
  - **Output Language**: English (`en`), Hindi (`hi`), Telugu (`te`)
  - **Custom Instructions**: Up to 500 characters with prompt-injection and anti-manipulation validation.
- **Strict Separation of AI Tasks**: Business-owner AI configuration shapes **only** owner replies to customer reviews and **never** alters or overrides customer review generation on `/r/:businessSlug`.

### 4. Business Knowledge & Local SEO Context (`/dashboard?tab=settings`) — Phase 4
- **Structured Business Knowledge**:
  - Business description, primary category, and additional info
  - Target Local SEO keywords
  - Products (with optional category and description)
  - Services
  - Explicit Service Areas (never inferred automatically from city)
- **Selective Relevance Matching**: Only products, services, keywords, or service areas relevant to a customer's review are passed into business-owner response generation. Never injected into customer-facing reviews.

### 5. Review Management System (`/dashboard?tab=drafts`) — Phase 5
- **4-Way Estimated Sentiment Classification**: Classifies feedback into `positive`, `neutral`, `negative`, or `mixed` (clearly labeled as automated text estimates, never hidden or gated).
- **Search & Filtering**: Filter by estimated sentiment, workflow status (`pending`, `draft_generated`, `approved`, `completed`), or full-text search across customer feedback, AI review drafts, and owner responses.
- **4-Stage Owner Response Workflow**:
  1. `Pending` — Customer feedback recorded; awaiting owner reply draft.
  2. `Draft Generated` — Owner generated or edited an AI response draft using Phase 3 tone/language and Phase 4 business knowledge.
  3. `Approved` — Owner reviewed and approved the reply draft.
  4. `Completed` — Owner externally posted their reply and marked the workflow complete.
- **90-Day Automatic Retention**: Customer drafts older than 90 days are automatically purged.

### 6. Platform Admin & Account Lifecycle (`/admin`)
- Platform-level administration for business approval (`pending`, `active`, `rejected`, `suspended`), account suspension/restoration, soft-delete (`pending_deletion`), and permanent account deletion via the `admin-delete-account` Edge Function, backed by an immutable `admin_audit_logs` trail.

---

## Official Brand System (v1.0)
- **Design Mode**: Light mode only (`color-scheme: light`)
- **Primary Font**: `DM Sans` across all headings, body copy, controls, and AI-generated text
- **Core Brand Palette**:
  - Forest Green: `#244B40`
  - Sage Green: `#A8BFA5`
  - Muted Yellow: `#E4BD63` (always paired with `#252B29` Charcoal text)
  - Warm Off-white: `#F7F7F2`
  - Charcoal: `#252B29`
- **Supporting Interface Palette**:
  - White: `#FFFFFF` | Border: `#DDE4DC` | Secondary Text: `#626B65` | Disabled Background: `#E8EBE7` | Disabled Text: `#747B76`

---

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Set your Supabase URL and publishable anon key in `.env.local`:
```env
VITE_SUPABASE_URL=https://jwgofsrubthumuymhzva.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
```
*(If `.env.local` is omitted, ReviewAssist runs in Local Demo Mode with realistic seeded businesses and local storage persistence.)*

### 3. Run the Development Server
```bash
npm run dev
```

---

## Supabase Database Migrations & Edge Functions

All SQL migrations are located in `supabase/migrations/` and must be applied in order:

1. [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql) — Core `businesses`, `analytics_events`, `customer_drafts`, rate limiting, and RLS policies.
2. [`supabase/migrations/002_schedule_rate_limit_cleanup.sql`](./supabase/migrations/002_schedule_rate_limit_cleanup.sql) — Scheduled cleanup for rate-limit buckets and 90-day draft retention.
3. [`supabase/migrations/003_platform_admin_and_account_lifecycle.sql`](./supabase/migrations/003_platform_admin_and_account_lifecycle.sql) — Platform admin RBAC, business approval lifecycle, account state management, and `admin_audit_logs`.
4. [`supabase/migrations/004_business_ai_configuration.sql`](./supabase/migrations/004_business_ai_configuration.sql) — Per-business AI tone, response length, language (`en`, `hi`, `te`), and custom instructions (`business_ai_configs`).
5. [`supabase/migrations/005_business_knowledge_and_local_seo.sql`](./supabase/migrations/005_business_knowledge_and_local_seo.sql) — Per-business Local SEO knowledge (`business_knowledge_profiles`).
6. [`supabase/migrations/006_review_management_system.sql`](./supabase/migrations/006_review_management_system.sql) — 4-way sentiment (`mixed` support), owner response draft columns, and workflow status triggers on `customer_drafts`.

### Verification SQL Scripts
After applying migrations in the Supabase SQL Editor or via `npx supabase db push`, you can verify schema & RLS integrity using:
- `supabase/verification/verify_admin_schema.sql`
- `supabase/verification/verify_ai_config_schema.sql`
- `supabase/verification/verify_business_knowledge_schema.sql`
- `supabase/verification/verify_review_management_schema.sql`

---

## Automated Verification & Test Suites

Run the automated verification suites (132 total checks across QR decoding, AI configuration, business knowledge, and review management):

```bash
# Phase 2 — QR Code Generation, PNG Decode & Printable A5 PDF Verification (45 checks)
npm run test:qr

# Phase 3 — Per-Business AI Configuration & Tenant Isolation (34 checks)
npm run test:ai-config

# Phase 4 — Business Knowledge & Local SEO Context (28 checks)
npm run test:knowledge

# Phase 5 — Review Management System & 4-Stage Response Workflow (25 checks)
npm run test:reviews

# TypeScript Typecheck & Production Build
npm run build

# Oxlint Static Analysis
npm run lint
```
