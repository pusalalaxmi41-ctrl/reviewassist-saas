---
trigger: always_on
description: Andrej Karpathy's 4 LLM coding principles (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution) merged with Vitaran / BistroOS multi-tenant architectural invariants.
---

# Karpathy Engineering Guidelines (`review-saas`)

Derived from `https://github.com/multica-ai/andrej-karpathy-skills` and merged with `ARCHITECTURE.md`:

1. **Think Before Coding**:
   - Inspect existing files, types, SQL migrations, and repository signatures before writing code. Never assume file names, column names, or RPC contracts.
   - Surface tradeoffs or numbering collisions (e.g., sequential migration numbers) explicitly.

2. **Simplicity First**:
   - Write the minimum, cleanest code that solves the exact requirement with zero speculative abstractions and zero new NPM packages.
   - Keep pure math/validation functions deterministic and isolated in `src/utils/`.

3. **Surgical Changes**:
   - Touch only the lines required in shared multi-industry routers (`types/business.ts`, `AdminPanelPage.tsx`, `BusinessDashboard.tsx`, `App.tsx`, `QRCodeManager.tsx` / `qrGenerator.ts`).
   - Preserve all existing vertical behaviors, comments, and verification tests untouched.
   - Clean up any unused imports or variables introduced by your own edits (`oxlint` must report `0` warnings and `0` errors).

4. **Goal-Driven Execution**:
   - Enforce 100% Dual-Mode Parity (`IBusinessRepository` -> `MockLocalStorageRepository` + `SupabaseBusinessRepository`), PostgreSQL `ENABLE + FORCE ROW LEVEL SECURITY`, `REVOKE ALL FROM public, anon`, `SECURITY DEFINER` with `SET search_path = public, pg_temp`, and `pg_catalog.substr()` (never `substring(... from ...)`).
   - Verify end-to-end with `npm run lint`, `npm run build`, and automated Deno verification suites (`tests/verify-*.ts`) until 100% pass.
