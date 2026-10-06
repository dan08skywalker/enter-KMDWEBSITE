# KMD EMPIRE — Professional Retailers & Members Dashboard

## Context

The master prompt describes a business system whose value is not its visuals but a **backend reward engine**: a qualified purchase must automatically produce correct Unilevel Bonus (Level 1–5) and Loyalty Credit ledger records for the correct uplines, idempotently, atomically, and then appear on the right dashboards without an administrator hand-entering anything.

Two facts shape this plan:

1. **The prompt targets Base44, which this workspace is not.** This is an Enter project (React 19 + Vite + TypeScript + Tailwind + shadcn). Enter's backend is **Enter Cloud** — managed Postgres, auth, storage and server-side backend functions. It supplies every capability the prompt requires, under different names. There is no Base44 API here, so the same architecture is implemented on Enter Cloud.
2. **Financial logic must not live in the browser.** All reward math, balance writes and idempotency checks are implemented in **PostgreSQL functions created by migrations** and invoked through backend functions. A Postgres function runs in a single transaction, which is what the prompt's atomicity and rollback requirements (§28) actually need — partial Level 1–4 distributions are impossible by construction.

Accepted assumptions (the clarifying questions were cancelled; each is changeable on request):

| # | Decision | Assumption |
|---|---|---|
| A1 | Backend | Enter Cloud, same entities/flows, reward math server-side in Postgres functions |
| A2 | Delivery | Milestones below, engine proven (M4) before UI polish (M7) |
| A3 | Reward config seed | L1/L2 use the prompt's given values; **L3–L5 and Loyalty Credit seed to 0**, admin-editable with audit logs. Temp values are used only inside the test run, then restored to 0 |
| A4 | Test data | Real rows in real tables, each flagged `is_test`, hidden from member/production lists by default, removable in one admin action |
| A5 | Login | Username + password in the UI; Enter Cloud auth is email-backed, so the backend resolves username → email. Email is still collected at registration as the prompt requires |
| A6 | Currency | 1 point = ₱1, rate stored in `system_settings` so it stays configurable |

## Architecture

### Trust boundary

```
Browser (React)                        Enter Cloud
──────────────────                     ────────────────────────────────
forms / tables / charts   ──invoke──▶  backend functions (auth + authorization only)
realtime subscriptions                 │  zod validate · role check · storage · audit
reads: RLS-scoped queries              ▼
                              .rpc() ─▶ plpgsql functions (ALL money math, one transaction)
                                        process_qualified_purchase
                                        approve_redemption · convert_to_wallet
                                        reconcile_balance
                                       ▲
                                       └─ ledger tables are INSERT-only; no client write policy
```

No backend function contains raw SQL — it authorizes, then calls `.rpc()`.

### Data model (migrations, RLS enabled in the creating migration)

| Table | Purpose / key columns |
|---|---|
| `profiles` | `id` → `auth.users`, `member_code` unique (`KMD-0000-0000-0000-0000`), name, mobile, email, `username` unique, `sponsor_code`, `direct_sponsor_id`, `referral_code`, `package_id`, `account_type`, `account_status`, `registration_date`, `activation_date`, `profile_photo_url`, `unilevel_points_balance`, `loyalty_credits_balance`, `shopping_wallet_balance`, `total_lifetime_earnings`, `is_test` |
| `user_roles` | `user_id`, `role` (`member\|retailer\|admin\|super_admin`), unique pair — never decide admin on the client |
| `products` | `product_code` unique, `name`, `sku` unique, `membership_code`, `category`, `product_type`, `selling_price`, `is_active` |
| `membership_packages` | `package_code`, `tier` (trial/classic/gold/platinum), `product_id` → `products`, `is_active` |
| `orders` | `order_number` unique, `buyer_profile_id`, `buyer_member_code`, `total_amount`, `status` (`pending_payment\|proof_submitted\|under_review\|confirmed\|rejected\|cancelled`), `qualification_source`, `rewards_processed`, `rewards_processed_at`, `processed_by` |
| `order_items` | `order_id`, `product_id`, `sku`, `product_name`, `quantity`, `unit_price` — product identity is permanently frozen here, never re-derived from a name |
| `payment_proofs` | `order_id`, member, `method`, `reference_number`, `amount`, `proof_path` (storage), `status`, reviewer, timestamps |
| `sponsor_relationships` | closure table: `descendant_id`, `ancestor_id`, `level` — created at registration for levels 1–5, so upline tracing is a lookup, not a walk |
| `reward_configurations` | `product_id` unique, `sku`, `level1_points`…`level5_points`, `loyalty_credit`, `is_active`, `updated_by` |
| `point_ledger` | immutable; all §13 fields incl. `unilevel_level`, `points_per_unit`, `total_points`, `reward_type`, `transaction_type`, `direction`, `trigger_event`, `processed_by`, **`idempotency_key` unique** |
| `loyalty_credit_ledger` | separate ledger, own `idempotency_key` unique |
| `shopping_wallet_ledger` | debit/credit pairs linked to the originating point-ledger row |
| `redemptions` | `redemption_number`, points, peso value, method (`gcash\|bank\|shopping_wallet`), bank fields, status, reviewer, reason |
| `audit_logs` | actor, action, member, order, `previous_value`, `new_value`, reason, timestamp |
| `system_settings` | key/value: `point_to_peso_rate=1`, `max_unilevel_levels=5`, package prices |
| `test_results` | one row per §36–§42 required test with expected/actual/verdict/reason |

`is_test` filtering keeps seeded fixtures out of production lists without forking the schema.

### Core engine — `kmd_process_qualified_purchase(p_order_id, p_actor)`

Single `SECURITY DEFINER` plpgsql function, one transaction:

1. `SELECT … FOR UPDATE` the order (serializes concurrent double-confirm clicks).
2. Return `ALREADY_PROCESSED` if `rewards_processed` — the fast path for §37.
3. Verify qualification (`status='confirmed'` or membership activated/posted/verified) → else `PAYMENT_NOT_CONFIRMED`.
4. Load buyer → `BUYER_NOT_FOUND`.
5. Per `order_items`: load product + `reward_configurations` by **product_id**, cross-check SKU → `NO_REWARD_CONFIGURATION` / `PRODUCT_INACTIVE` / `SKU_MISMATCH`.
6. For levels 1–5: resolve ancestor from `sponsor_relationships`; missing/absent level → `LEVEL_n_UPLINE_DOES_NOT_EXIST`; inactive upline → skipped with a reason. `points = level_points × quantity`. Non-zero config → insert ledger row with `idempotency_key = order:item:beneficiary:UNILEVEL_BONUS:L{n}`, `ON CONFLICT DO NOTHING`.
7. Loyalty Credit for the configured beneficiary, own idempotency key and ledger.
8. Update the cached balances on `profiles` in the same transaction.
9. Set `rewards_processed`, write `audit_logs`, return a `jsonb` summary (per-level points, ledger ids, skipped levels, reasons).

Any `RAISE EXCEPTION` rolls back the entire distribution — no partial payouts. Idempotency is enforced twice: the `rewards_processed` flag and unique `idempotency_key` indexes.

**Balance integrity (§29):** `kmd_member_balances(member)` = valid credits − valid debits per ledger. Cached columns exist for speed; `kmd_reconcile_member_balance(member)` compares cached vs ledger-computed and reports discrepancies.

### Backend functions (`supabase/functions/<name>/index.ts`, deployed via `supabase_deploy_edge_function`)

| Function | Access | Responsibility |
|---|---|---|
| `register-member` | public | validate (min 6 chars, letters/numbers), username + sponsor checks, create auth user with metadata; the `handle_new_user` trigger generates `member_code` and the level 1–5 sponsor closure atomically |
| `account-lookup` | public | `check_username`, `sponsor_preview` (referral `?ref=`), `resolve_login` (username → email) |
| `payment-actions` | member + admin | `submit_proof` (uploads to private bucket), `review`, `confirm` → engine, `reject`, `cancel`; every admin action audited |
| `process-qualified-purchase` | admin | manual/retry wrapper around the engine |
| `member-actions` | member | `request_redemption` (validates against ledger balance), `convert_to_wallet`, `update_profile` |
| `admin-actions` | admin | redemption approve/reject, member activate/deactivate, **sponsor change** (cycle-checked, closure rebuilt, audited), point/loyalty adjustment (creates adjustment entries, never edits history), reward-config update, settings update |
| `reward-diagnostics` | admin | the §26 15-point checklist with real reasons per order |
| `reconcile-balance` | admin | §29 displayed vs ledger |
| `seed-test-environment` | bootstrap, then super admin | creates the L1–L5 chain, products, orders (flag `is_test`) |
| `run-required-tests` | super admin | executes §36–§42 through the real engine, writes `test_results`, restores config |

### Frontend

Reuses existing shadcn primitives (`button`, `card`, `table`, `sidebar`, `dialog`, `tabs`, `select`, `form`, `badge`, `chart`, `sonner`, `calendar`) and `cn` from `src/lib/utils.ts` — no parallel component library.

```
src/
  contexts/auth-context.tsx            session + profile + roles (onAuthStateChange, listener registered before session restore, no async callback, deferred client calls)
  hooks/                               use-member-summary, use-ledger, use-realtime-refresh, use-profile, use-mobile (exists)
  lib/kmd/                             format.ts (₱/points/date), labels.ts (status tone maps), constants.ts (banks, levels)
  components/layout/                   member-layout, admin-layout, app-sidebar, app-topbar, route-guard, admin-guard
  components/kmd/                      stat-card, page-header, data-table, filter-bar, status-badge, empty-state, genealogy-tree, member-node, loyalty-card-art, order-timeline, diagnostics-checklist, confirm-dialog
  pages/{public,member,admin}/…        routes registered in src/router.tsx
```

Routes: public `/`, `/login`, `/register`, `/forgot-password`; member `/app/*` — dashboard, profile, loyalty-cards, team, genealogy, unilevel-earnings, loyalty-credits, point-transactions, shopping-wallet, redeem, orders, orders/:id, referral, settings; admin `/admin/*` — dashboard, members, retailers, orders, payment-verification, products, packages, reward-configuration, point-transactions, loyalty-transactions, redemptions, genealogy, diagnostics, audit-logs, settings, verification-report.

Realtime on `profiles, orders, point_ledger, loyalty_credit_ledger, shopping_wallet_ledger, redemptions, audit_logs` drives §32 no-refresh updates.

Security (§30): ledger and audit tables have **no** client write policies; `user_roles` is not client-writable; a trigger rejects client changes to protected profile columns (`member_code`, sponsor, balances) unless the actor is an admin; reward amounts are never accepted from the client.

## Design

Run the `designer` agent first for tokens, then implement in `src/index.css` + `tailwind.config.ts`: deep navy/royal palette with gold and platinum accents (matching the loyalty card tiers), Inter typography, semantic HSL tokens only — no `text-white`/`bg-black` literals. Elegant loyalty card art (~18px member name, ~16px card number, minimal boxed fields). Diagnostics render lucide `CheckCircle2`/`XCircle`, never emoji. Responsive: member sidebar collapses on mobile; tables scroll horizontally.

## Milestones

| M | Scope | Exit condition |
|---|---|---|
| M1 | Cloud enabled; all tables + RLS + plpgsql engine + seeded products/reward config/settings | every table verified via `supabase_get_table_schema` with RLS on and policies listed |
| M2 | Registration, referral `?ref=`, username login, forgot-password, auth context, guards, genealogy closure | a real registration creates profile + member_code + level 1–5 closure |
| M3 | Products/SKUs, orders, payment proof upload, admin verification queue, confirm → engine | confirming an order produces ledger rows |
| M4 | Test environment + required tests §36–§42 + verification report | `test_results` rows read back from the database |
| M5 | Member pages (dashboard, ledgers, team/genealogy, cards, wallet, redeem, orders, referral) | pages read real rows, realtime updates |
| M6 | Admin suite, reward config matrix, diagnostics, audit logs, reconciliations, redemption approval | admin can change compensation without touching source |
| M7 | Design polish, responsive pass, lint/types/build, final acceptance report | §44 table produced from real records |

## Critical files

- Migrations: applied via `supabase_migration` (schema, RLS, `handle_new_user`, `kmd_process_qualified_purchase`, balance/reconcile functions)
- `supabase/functions/{register-member,account-lookup,payment-actions,process-qualified-purchase,member-actions,admin-actions,reward-diagnostics,reconcile-balance,seed-test-environment,run-required-tests}/index.ts`
- `src/router.tsx`, `src/contexts/auth-context.tsx`, `src/components/layout/*`, `src/components/kmd/*`, `src/pages/**`
- `src/index.css`, `tailwind.config.ts`
- `CodeGuideline.md` — project convention requires updating the module/page map when pages are added

## Verification

Structural and data checks via `supabase_get_table_schema` / `supabase_read_query`; behavioral checks by exercising the deployed functions over HTTP (`curl` with the anon key from the generated client) as the bootstrapped super admin, then reading `test_results`, `point_ledger`, `loyalty_credit_ledger` and cached balances back through read queries. §36–§42 map onto the required checks:

1. pending purchase → no rewards; proof submitted → still no rewards; admin confirm → engine fires
2. confirm twice → `REWARD ALREADY PROCESSED FOR THIS TRANSACTION`, zero duplicate rows
3. 10 × Trial Pack → Level 1 = 1,500 points, asserted against the actual ledger row
4. Dokudami multi-unit reorder → per-unit × level values
5. invalid SKU / missing sponsor / inactive product / unconfirmed payment / missing config → safe failure, no partial rewards
6. temporary loyalty config → loyalty ledger row exists and loyalty balance moves while unilevel stays separate
7. available 1,500 → 2,000 rejected as insufficient; 1,000 accepted

If the sandbox has no outbound network, the same harness is invoked from the admin Reward Engine Diagnostics page instead, and any check that cannot be observed in the database is reported as **unverified**, never as PASS.

Build scope: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm run build`. Visual checks via `website_screenshot` at `mobile_390` and `desktop_1280`.

## Implementation checklist

- [ ] `supabase_enable`, then load the `enter_cloud` reference for migrations before writing schema
- [ ] `supabase_configure_auth` — auto-confirm email signups so registration needs no mail round-trip
- [ ] Migration: `profiles`, `user_roles`, `products`, `membership_packages`, `orders`, `order_items`, `payment_proofs`, `sponsor_relationships`, `reward_configurations`, `point_ledger`, `loyalty_credit_ledger`, `shopping_wallet_ledger`, `redemptions`, `audit_logs`, `system_settings`, `test_results` — all with `enable row level security` in the same migration
- [ ] Unique indexes: `profiles.member_code`, `profiles.username`, `products.sku`, `orders.order_number`, `point_ledger.idempotency_key`, `loyalty_credit_ledger.idempotency_key`
- [ ] `has_role()` security-definer helper; `kmd_is_in_downline()` for team visibility
- [ ] `handle_new_user` trigger: member_code from sequence (`KMD-0000-0000-0000-0000`), profile row, sponsor closure levels 1–5
- [ ] Trigger blocking client edits to `member_code`, sponsor ids and the three balance columns
- [ ] `kmd_process_qualified_purchase` with the 9 steps above, `FOR UPDATE` lock, dual idempotency, balance updates, audit row, jsonb summary
- [ ] `kmd_member_balances` and `kmd_reconcile_member_balance`
- [ ] plpgsql functions for redemption approval/rejection and points → shopping wallet conversion (debit + credit pair, atomic)
- [ ] Seed products/packages (Trial, Classic, Gold, Platinum, Dokudami), reward config L1/L2 given values, L3–L5 = 0, loyalty = 0, `point_to_peso_rate = 1`
- [ ] Private `payment-proofs` storage bucket + policies (owner own, admin all)
- [ ] Realtime publication on the seven operational tables
- [ ] Each of the ten backend functions written with CORS + OPTIONS preflight, one responsibility, and deployed
- [ ] Auth context with listener registered before session restore; route guards for member and admin areas
- [ ] Register page reads `?ref=`, resolves and locks the sponsor, enforces min 6 characters
- [ ] Login page uses username + password with `REGISTER NOW` and forgot-password links
- [ ] `seed-test-environment` creates the buyer plus L1–L5 sponsors chained through real sponsor relationships
- [ ] `run-required-tests` executes §36–§42 through the real engine and records verdicts with reasons
- [ ] Member pages (14) and admin pages (16) per the route list, all reading live data
- [ ] Reward configuration matrix editable without touching source code; every change audited
- [ ] Diagnostics page renders all 15 checks with the specific failure reason
- [ ] Design tokens applied in `index.css` + `tailwind.config.ts`; `CodeGuideline.md` structure map updated

## Verification checklist

- [ ] Every table confirmed via `supabase_get_table_schema` with RLS enabled and its policies present
- [ ] `supabase_read_query` shows products seeded with the prompt's L1/L2 values and L3–L5 at 0
- [ ] Registration creates a profile with a unique `KMD-####-####-####-####` code and closure rows at levels 1–5
- [ ] A second registration cannot reuse an existing username or member code (negative check)
- [ ] Opening a referral link pre-fills and locks the sponsor; an invalid `ref` is rejected (boundary check)
- [ ] Test #1: no rewards at `pending_payment`, none at `proof_submitted`, rewards only after confirm
- [ ] Test #2: second confirm returns already-processed and `point_ledger` row count is unchanged
- [ ] Test #3: 10 × Trial Pack yields exactly 1,500 Level 1 points in the ledger
- [ ] Test #4: multi-unit Dokudami rewards equal quantity × configured per-unit value
- [ ] Test #5: each broken case fails safely with its specific reason and zero new ledger rows
- [ ] Test #6: loyalty ledger row and balance move; unilevel ledger unaffected
- [ ] Test #7: 2,000 of 1,500 rejected; 1,000 accepted
- [ ] `kmd_reconcile_member_balance` reports no discrepancy for every touched member
- [ ] Member-facing queries exclude `is_test` rows by default
- [ ] A member cannot read another member's ledger, order or redemption rows (RLS negative check)
- [ ] `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm run build` all pass
- [ ] Dashboards, transactions and balances render live values and update after a reward posts
- [ ] Member and admin routes checked at `mobile_390` and `desktop_1280`
- [ ] §44 verification report produced from actual records, with every FAIL explained
