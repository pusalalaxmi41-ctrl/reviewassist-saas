# ReviewAssist v5: Security Review Report

> [!IMPORTANT]
> **Status: nothing has been applied, deployed, or connected.** The remote database was not touched and the frontend was not changed. This work is **not production-ready**.

## Files

| Deliverable | File | Changed? |
|---|---|---|
| A. Migration | [001_initial_schema.sql](file:///c:/work/review-saas/supabase/migrations/001_initial_schema.sql) | Rewritten (v5) |
| A. Cron migration | [002_schedule_rate_limit_cleanup.sql](file:///c:/work/review-saas/supabase/migrations/002_schedule_rate_limit_cleanup.sql) | New |
| B. Edge Functions | [public-business-lookup](file:///c:/work/review-saas/supabase/functions/public-business-lookup/index.ts), [generate-review-draft](file:///c:/work/review-saas/supabase/functions/generate-review-draft/index.ts), [track-customer-event](file:///c:/work/review-saas/supabase/functions/track-customer-event/index.ts) | Small hardening edits |
| C. Config | [config.toml](file:///c:/work/review-saas/supabase/config.toml) | No change needed |
| D. Verification | [verify_schema.sql](file:///c:/work/review-saas/supabase/verification/verify_schema.sql) | New (outside `migrations/`, so it never gets pushed) |

**Local checks that were actually run:**
- All SQL files parsed with no errors in libpg_query, the real PostgreSQL parser compiled to WASM. That covers 101 statements in 001, 3 in 002, and all 12 PL/pgSQL bodies, including the DO blocks.
- `deno check` passes for all three functions.
- **Limit:** parsing only checks syntax. Nothing has been run against a real Postgres or Supabase instance.

---

## 1. Scheduled cleanup

- **How it works:** migration 002 turns on `pg_cron` (Supabase Cron) and adds the job `reviewassist-prune-expired-rate-limits`.
  - It runs every 10 minutes: `select public.prune_expired_rate_limits(86400, 5000);`
  - Each run deletes at most 5,000 rows older than 24 h, so the most it can delete is about 720k rows per day.
  - Re-running the migration doesn't add a second job, because `cron.schedule` with the same name replaces the existing one.
- **Who can call it:**
  - The job runs as the role that scheduled it, normally `postgres`. That role owns the function, so it has EXECUTE.
  - The only other role with EXECUTE is `service_role`.
  - PUBLIC, anon and authenticated have EXECUTE revoked, so PostgREST returns `42501` if they try.
- **Safety assertion:** the rate-limit table uses FORCE RLS, so 002 checks that the job role has BYPASSRLS and EXECUTE before scheduling anything. If not, it stops.
- **Retention floor:** `p_retention_seconds` now has a minimum of 86400. That is at least as long as the largest window `consume_rate_limit` accepts, so cleanup can never delete rows from a window that is still counting.
- **Checking that it runs:** use the `cron.job_run_details` queries at the end of `verify_schema.sql`. Expect `succeeded` runs every 10 minutes and zero rows older than 25 h once the backlog is cleared.

## 2. Rate-limit timing

`consume_rate_limit()` now runs in this order: validate inputs → `pg_advisory_xact_lock(bucket)` → `v_now := clock_timestamp()` → prune the bucket → count → insert with `created_at = v_now`.

- The count and the insert both happen while the lock is held, so concurrent requests can't both slip under the limit.
- The inserted timestamp is the same `v_now` used for the window. Before, it fell back to `now()`, which is the transaction start time and can be out of date if the request waited for the lock.

## 3. Full upgrade validation (section 0)

Before anything is changed, a read-only check compares **every existing table** to the v5 schema. It runs in two phases, and each phase stops with **one** exception that lists every problem it found:

- **Phase A (structure):** missing columns, wrong data types (nothing is cast automatically), primary key not exactly `(id)`, a foreign key pointing at the wrong parent, or a child table that exists without its parent.
- **Phase B (data):** NULLs in columns that must be NOT NULL (with a specific message for `owner_id`), rows that would break any of the 14 CHECK constraints (counted with the exact constraint expressions), duplicate slugs, and orphan foreign-key rows (including `owner_id` values with no matching `auth.users` row).
- **Reported but not treated as errors:** default values that differ from the target, and extra columns. Extra columns are **left in place**.

Only after both phases pass does section 2 fix up the schema: add missing columns, set NOT NULL, set defaults, enforce a unique slug, and replace the foreign keys and CHECK constraints with the correct versions. **No row is deleted or changed.** `ADD COLUMN … DEFAULT` only fills in the newly added column.

## 4. SECURITY DEFINER hardening

**Finding: none of the functions needs SECURITY DEFINER, so v5 has none.**
- The server-side functions can only be run by `service_role`, which already has BYPASSRLS and full table grants. Running them as the function owner added risk and gave nothing back.
- A real bug is also fixed: with FORCE RLS on, a definer function owned by a role **without** BYPASSRLS would have seen zero rows.
- **search_path:** every function uses `search_path = pg_catalog, pg_temp`, and every application object is schema-qualified (`public.*`, `auth.uid()`). `public` is left out of the path on purpose. A later schema in the path can still win overload resolution, so the safest path is one that includes no schema an API role could write to.
- `revoke create on schema public from public, anon, authenticated` blocks attempts to shadow objects.
- **EXECUTE grants, revoked from everyone first and then granted only as follows:**

| Function | PUBLIC | anon | authenticated | service_role |
|---|---|---|---|---|
| `is_business_owner`, `get_business_metrics` | ✗ | ✗ | ✓ | ✗ |
| `get_public_business_by_slug`, `consume_rate_limit`, `prune_expired_rate_limits`, `record_customer_draft_with_events`, `purge_expired_customer_drafts` | ✗ | ✗ | ✗ | ✓ |
| `enforce_businesses_update_rules` (trigger) | ✗ | ✗ | ✗ | ✗ |

- **Built-in assertions:** section 13 stops the migration if `service_role` lacks BYPASSRLS, or if any of these functions is SECURITY DEFINER, is missing the hardened search_path, or is owned by an API role.
- **Policy cleanup:** besides the 7 named v1 drops, any **other** policy on the four tables is dropped, with a NOTICE for each.

## 5. Customer data retention (proposal: needs your decision)

| Data | Contains PII / free text? | Proposed retention | Mechanism |
|---|---|---|---|
| `customer_drafts` (raw input + generated review) | **Yes** | **90 days (approved 2026-11-11)** | `purge_expired_customer_drafts(90, 5000)`, scheduled hourly in 002 |
| `analytics_events` | No (counts, mode, length, sentiment) | Keep (suggest reviewing at 13 months) | none |
| `submission_rate_limits` | Hashed IP only | 24 h | Cron job in 002 |

- **Why 90 days:** long enough for an owner to read recent feedback, short enough to keep raw customer text to a minimum. The function deliberately has **no default**, so the period must be passed in explicitly. Allowed values are 7 to 3650 days.
- **Analytics stay intact:** the dashboard metrics come only from `analytics_events`, which references `business_id` and not the draft. Deleting drafts never changes the counts, and event metadata never stores customer text.
- **Turning it on later:** after you approve a period, add the commented-out `cron.schedule` from 002, and tell customers about the retention period on the review page.
- **Not built yet:** deleting a single customer's data on request. Customers are anonymous, so there's no identity to match a request against.

## 6. Edge Function verification (actual files inspected)

| Requirement | Result |
|---|---|
| Global rate limit before body parsing or slug lookup | ✅ In all 3. `consume_rate_limit(<fn>:global)` is called before `readJsonObjectWithByteLimit`. |
| Per-business limit after the business is found | ✅ draft (5/h) and event (10/h). Lookup has no per-business write, so it only has the global limit (30/h). |
| Trusted IP | ✅ Uses `cf-connecting-ip` only. **Now also checks the value is a real IPv4/IPv6 address** and ignores it otherwise. `x-forwarded-for` and `user-agent` are never used. |
| Body size limits | ✅ Checks `Content-Length` and counts bytes while streaming; returns 413 above 4 KB (lookup/event) or 8 KB (draft). |
| Body must be a plain object | ✅ `null`, arrays and primitives get 400. Invalid UTF-8 or invalid JSON gets 400. |
| Safe errors | ✅ Database errors map to generic messages. **New: a top-level try/catch** returns a generic 500 for any unexpected exception. |
| JWT settings | ✅ `verify_jwt = false` on all 3. Customers are anonymous and `sb_publishable_…` keys aren't JWTs. No other function exists that would need JWT verification. |
| Service-role key kept out of the frontend | ✅ Read only through `Deno.env` inside the functions. A scan of `src/`, `.env.local` and `dist/` found only comments. The frontend uses only `VITE_SUPABASE_PUBLISHABLE_KEY`. |

---

## Deployment order (for when you approve; not done)

1. Apply `001` on a **staging/branch** project first, then run `verify_schema.sql`. Every row should say PASS except check 12, which will FAIL until 002 is applied.
2. Apply `002`, run `verify_schema.sql` again (all rows PASS), and wait about 15 minutes before running the cron run-history queries.
3. Set the function secrets: `supabase secrets set ALLOWED_ORIGINS=https://<staging-domain> LOG_IP_SOURCE=true`.
4. Deploy the three functions with `supabase functions deploy <name>`. `config.toml` already sets `verify_jwt = false`.
5. **IP check on staging:** send a few requests from two different networks, then look at the `ip_source_diagnostic` log lines.
   - **Expected:** `source = "cf-connecting-ip"` and `cf_connecting_ip_valid = true` on every line.
   - **Spoof test:** send a forged `cf-connecting-ip` header and confirm the rate-limit bucket doesn't change, i.e. Cloudflare overwrites the header. Without the platform overwriting it, the header can be spoofed.
   - **Afterwards:** set `LOG_IP_SOURCE=false`.
6. Run the security test matrix from the previous turn against staging, then set `ALLOWED_ORIGINS` to the production origin.

## v5.1 update (2026-11-11, local only)

- **CORS** is no longer `*`. Only origins listed in the `ALLOWED_ORIGINS` secret get `Access-Control-Allow-Origin`; the default is `http://localhost:5173`. Every response, including errors and 405s, carries `Vary: Origin`, and preflight requests return 204.
- **IP-source diagnostic:** an opt-in `LOG_IP_SOURCE=true` logs which source produced the client IP and whether `cf-connecting-ip`, `x-forwarded-for` or `x-real-ip` were present. It **never logs IP addresses or header values**.
- **Retention:** 90 days approved. Migration 002 now schedules `reviewassist-purge-customer-drafts` hourly at minute 23: `purge_expired_customer_drafts(90, 5000)`. `verify_schema.sql` check 12 asserts both cron jobs.
- **Checks run locally:**
  - `deno check` passes.
  - SQL passes the PostgreSQL parser.
  - Local runtime test passed: allowed origin got ACAO, disallowed origin got none, 405 on GET, and the diagnostic logs contained no IP values.

## E. Unresolved risks

1. **`cf-connecting-ip` hasn't been confirmed on the deployed runtime.** If Supabase's gateway doesn't set it, or lets a client-supplied value through, every client either lands in one shared bucket (an availability risk) or can pick its own bucket (a bypass). Confirm this on staging by logging whether the header is present, never its value, before relying on the limits.
2. **IP-based limits are weak against distributed abuse.** Botnets and IPv6 address rotation get around per-IP buckets. Real users behind carrier-grade NAT can also be limited unfairly. A CAPTCHA or Turnstile on draft generation is the next step up.
3. **Nothing has been run against Postgres.** The SQL was syntax-checked only. Column, operator and permission behaviour (for example, whether `postgres` has BYPASSRLS on this project, and whether `pg_cron` is available) will only be known on staging. The built-in assertions will stop the migration rather than half-apply it, as long as it runs inside a transaction, which `supabase db push` does.
4. **Supabase default privileges.** New tables and functions in `public` are still automatically granted to anon/authenticated by Supabase's `ALTER DEFAULT PRIVILEGES`. This migration explicitly revokes those grants on its own objects. Any future migration must do the same, or the default privileges should be changed project-wide (not done here because it would affect everything).
5. **`revoke create on schema public`** narrows permissions. Check that no tooling relies on API roles creating objects.
6. **Ownership transfer** is blocked for everyone, including `service_role`, by the trigger. A deliberate admin procedure will be needed later.
7. **Retention decided (90 days) and scheduled in 002.** Still missing: telling customers about the retention period in the review-page UI (no frontend change yet).
8. **CORS** is now restricted by `ALLOWED_ORIGINS`. CORS only limits browsers; scripts can still call the endpoints, which is why the rate limits stay the main control.
9. **`config.toml` `[db] major_version = 15`** only affects the local stack. Match it to the remote project's Postgres version before using `supabase start`.
10. **Rate-limit table growth** depends on cron running. If cron is down, rows build up, though `consume_rate_limit` still prunes each bucket as it's used.
