# KMD Empire — Public Storefront, Brand Rebuild & Commerce Completion

## Context

The first build delivered a verified Unilevel reward engine plus internal member and
admin dashboards. It has **no public website**: the landing page is a placeholder that
only lists membership packages, there is no retail catalogue, no cart, no checkout, no
guest ordering, no inventory, no shipping, no support, and no brand identity. The design
document supplied by the owner (`For Website Design KMDEmpire.docx`, re-read from
`/workspace/inputs/4074f64f-.../`) describes a complete customer-facing business —
brand story, six sellable products, payment options, testimonials, contact details,
social links, and a footer of content pages — none of which exists yet.

This phase turns the project into the actual KMD Empire website, wires real commerce on
top of the existing ledger, applies the authoritative reward matrix, and re-skins every
surface in the owner's black / green / gold / white identity.

**Not in scope:** changing the reward engine's core algorithm, the ledger schema, the
authentication model, or any existing admin income statement — those already pass the
required tests and are extended, never rewritten.

---

## Locked decisions (confirmed with the owner)

| # | Decision |
|---|---|
| 1 | **Payment accounts:** import all; auto-flag the 5 ambiguous ones; checkout shows only verified accounts. Flagged rows stay admin-only with a one-click Verify. |
| 2 | **Landing Page Service price:** Regular ₱25,000 / Promo ₱9,999 (document figure wins). |
| 3 | **Other retail prices:** verbatim from the document. |
| 4 | **Checkout:** true guest checkout with name, phone, email only. No account required. |
| 5 | **Shipping:** region zones Luzon / Visayas / Mindanao seeded **without fee amounts yet** → checkout must block with "shipping quote pending" until the owner enters them in the new Delivery & Shipping page. |
| 6 | **Testing:** seed `is_test` members/orders and run the whole required suite against the live backend, reporting PASS / FAIL / NOT RUN with evidence. |
| 7 | **Testimonials:** the cancer-outcome testimonial is **excluded** from promotion (spec §19). |
| 8 | **Dokudami:** presented as a food supplement with the document's educational-only disclaimer; the MDPI review link is shown as further reading. No disease claims. |

---

## Current state

**Exists and is reused as-is:**
- Reward engine `kmd_process_qualified_purchase`, balances `kmd_member_balances`, order creation `kmd_create_order`, payment confirmation `kmd_confirm_payment`, `kmd_reverse_reward`, `kmd_audit`, `kmd_readiness`-style helpers.
- 16 tables incl. `products`, `orders`, `order_items`, `payment_proofs`, `point_ledger`, `loyalty_credit_ledger`, `shopping_wallet_ledger`, `reward_configurations`, `system_settings`, `audit_logs`, `test_results`.
- Frontend: `AppShell` (member/admin), 19 admin pages, 14 member pages, shared `components/kmd/*` primitives (`DataTable`, `PageHeader`, `StatusBadge`, `FilterBar`, `EmptyState`, `Amount`, `ConfirmActionDialog`), `lib/kmd/*` (`invoke`, `format`, `labels`, `types`, `constants`).
- Backend functions: `admin-actions`, `member-actions`, `account-lookup`, `register-member`, `reward-diagnostics`, `run-required-tests`, `seed-test-environment`.
- i18n scaffolding: `src/i18n/config.ts` + `src/components/language-switcher.tsx` (currently `en`, `zh-CN`).

**Missing (this phase):** public site, retail catalogue, cart, checkout, guest orders, inventory/reservations, shipping zones, payment account registry, bundles, support tickets, notifications, announcements/blog/knowledge centre, admin exports, readiness checklist, brand identity, and the corrected reward matrix.

**Known data gaps already present:** all five membership packages have `selling_price = 0`; `reward_configurations.level3–5` and `loyalty_credit` are all zero; the Dokudami product's `product_code` is `KMD-PROD-0005`, not `DOK-REORDER`.

---

## Architecture

### 1. Data model — one migration `supabase/migrations/migration_20261007_1_commerce.sql`

All additions are **nullable, additive, same-business extensions** of tables this project
already owns. Existing rows and the reward engine keep working unchanged.

**Extend `products`** (null-safe adds):
`slug text unique`, `short_description text`, `description text`, `image_url text`,
`gallery jsonb default '[]'`, `regular_price numeric(14,2)`, `promo_price numeric(14,2)`,
`track_inventory boolean default true`, `is_digital boolean default false`,
`sort_order int default 0`, `brand text`, `disclaimer text`.
Widen the `product_type` check to `('membership','bundle','reorder','retail','digital')`.

*Single source of truth for price:* a `BEFORE INSERT OR UPDATE` trigger sets
`selling_price = coalesce(promo_price, regular_price, selling_price)`. The engine and
`kmd_create_order` already read `selling_price`, so order totals and reward values can
never diverge from the displayed promo price.

**New tables**
- `inventory` — `product_id unique`, `quantity_on_hand`, `reserved_quantity`, `low_stock_threshold`, `is_unlimited`, `updated_by`, `updated_at` (checks: both counts `>= 0`, `reserved <= on_hand` unless unlimited).
- `stock_movements` — append-only audit: `product_id`, `delta`, `quantity_before`, `quantity_after`, `reason` in (`reservation`,`release`,`sale`,`restock`,`adjustment`,`damage`,`return`), `order_id`, `actor_id`, `note`, `created_at`.
- `stock_reservations` — `product_id`, `order_id`, `quantity`, `status` in (`held`,`committed`,`released`,`expired`), `expires_at`, timestamps. Reserve on order creation, commit on payment confirm, release on reject/cancel/expiry.
- `delivery_zones` — `name`, `coverage`, `shipping_fee`, `free_shipping_threshold`, `estimated_days_min/max`, `is_active`, **`is_configured boolean default false`**, `sort_order`. Seeds `Luzon`, `Visayas`, `Mindanao` with `shipping_fee = 0, is_configured = false`.
- `payment_accounts` — `method` in (`gcash`,`maya`,`maya_bank`,`bank_transfer`,`cash`,`other`), `bank_name`, `account_name`, `account_number`, `qr_image_url`, **`is_verified`**, **`flag_reason`**, `is_active`, `sort_order`. RLS: `anon`/`authenticated` may read **only** `is_active AND is_verified`.
- `bundle_components` — `bundle_product_id`, `component_product_id`, `quantity`, unique pair.
- `order_status_history` — `order_id`, `from_status`, `to_status`, `note`, `actor_id`, `created_at`.
- `support_tickets` / `ticket_messages` — `ticket_number`, member or guest identity, `order_id`, `subject`, `category`, `priority`, `status` in (`open`,`in_progress`,`waiting_customer`,`resolved`,`closed`), `assigned_to`; messages carry `author_role` and `is_internal`.
- `notifications` — `profile_id`, `type`, `title`, `body`, `link`, `is_read`, `read_at`, `metadata`.

**Extend `orders`** for guest + fulfilment:
`buyer_profile_id` becomes nullable with a check (`buyer_profile_id is not null OR guest_email is not null`);
add `customer_type` (`member`,`guest`), `guest_name`, `guest_phone`, `guest_email`,
`delivery_zone_id`, `shipping_address`, `shipping_barangay/city/province/postal_code`,
`subtotal`, `shipping_fee`, `is_shipping_quoted`, `payment_method`,
`fulfillment_status` (`unfulfilled`,`preparing`,`shipped`,`delivered`,`cancelled`),
`courier`, `tracking_number`, `shipped_at`, `delivered_at`,
`access_token uuid default gen_random_uuid()`.
Extend `payment_proofs`: `member_id` nullable + `guest_email`, `guest_name`.

**Extend `reward_configurations`**: add `CHECK (loyalty_beneficiary_level = 1)` — enforces
"Level 2–5 always receive zero Loyalty Credits" at the database, not just in code.

**Reuse `system_settings`** for site content and policy knobs (no new settings table):
`site.contact.phones`, `site.contact.emails`, `site.social.*`, `site.announcement`,
`site.footer.tagline`, `site.mission`, `site.vision`,
`stock_reservation_hours` (72), `free_shipping_threshold`, `bundle_reward_policy`
(`bundle_sku` | `components`), `support_email`, `policy_version`.

**No cart table** — the cart lives in `localStorage` (`kmd.cart.v1`) so it survives guest → register → login exactly as the spec requires, with no anonymous-write surface.

### 2. Storage buckets
- `product-images` (public read, admin write)
- `payment-proofs` (private; write via backend function, admin reads via signed URL)
- `support-attachments` (private)

### 3. Catalogue seed (verbatim from the document)

| Code | Name | Type | Regular | Promo | Image |
|---|---|---|---|---|---|
| `DOK-REORDER` | Dokudami Capsules | reorder | 3,000.00 | 1,850.00 | dokudami.png |
| `KMD-POWERPILL-75L` | PowerPill Plus (75L / Pill) | retail | 1,350.00 | 950.00 | powerpill-75l |
| `KMD-POWERPILL-15L` | PowerPill Plus (15L / Pill) | retail | 300.00 | 250.00 | powerpill-15l |
| `KMD-LED-BULB` | Intelligent Emergency LED Bulb | retail | 1,500.00 | 1,200.00 | led-bulb.png |
| `KMD-CLOSET` | KMD Closet Apparel | retail | 499.00 | 249.00 | kmd-closet |
| `KMD-DIGITAL-LP` | Website / Landing Page Service | digital | 25,000.00 | 9,999.00 | digital-services |

**Codes are exact** — the existing Dokudami row is retargeted to `product_code = 'DOK-REORDER'`
so it resolves to the correct reward row, rather than creating a duplicate Dokudami SKU.
The five membership bundles keep their existing codes.

Images are extracted from the `.docx` media folder into `public/brand/` (`logo.png`,
`hero-banner.png`, `greenchoyce.png`) and `public/products/` — each mapped from its
document relationship id and **visually verified before wiring** (a mismatch is caught and
corrected, never guessed).

### 4. Reward matrix — authoritative, applied to live data

| Product | L1 | L2 | L3 | L4 | L5 | Loyalty (L1 only) |
|---|---|---|---|---|---|---|
| `DOK-REORDER` | 10 | 5 | 5 | 5 | 5 | 0 |
| Trial Pack Bundle | 150 | 20 | 10 | 5 | 5 | 0 |
| Classic Loyalty Card Bundle | 300 | 40 | 20 | 10 | 10 | 2 |
| Gold Loyalty Card Bundle | 600 | 100 | 40 | 20 | 20 | 4 |
| Platinum Loyalty Card Bundle | 5,000 | 300 | 150 | 100 | 50 | 30 |

Applied through the existing audited `kmd_update_reward_config` path. New retail SKUs
seed **reward-neutral (all zeros)** and appear in Reward Configuration with a readiness
item, satisfying "products with no configured values must remain reward-neutral".
Loyalty is pinned to `loyalty_beneficiary_level = 1`; the engine gains an explicit guard
so a level > 1 can never post a Loyalty Credit.

### 5. Server functions

**New**
- `storefront-catalog` (`verify_jwt = false`) — one round trip returning active products (with regular/promo/effective price, stock state, images), membership packages, active delivery zones **with `is_configured`**, verified payment accounts, and the public subset of `system_settings`. Keeps the anonymous surface minimal and guarantees flagged accounts never leak.
- `checkout-actions` (`verify_jwt = false`) — `quote`, `place_order`, `submit_proof`, `track_order`, `support_create`, `support_reply`.
  - `place_order` **never trusts client prices**: it re-reads each SKU from `products`, then in one transaction locks the `inventory` row `FOR UPDATE`, verifies availability, writes `stock_reservations` (`held`, `now() + stock_reservation_hours`), creates the order + items + status history, and returns `orderNumber` + `accessToken`. Zero or partial stock raises a validation error — nothing is written.
  - `quote` returns `SHIPPING_NOT_CONFIGURED` when the chosen zone has `is_configured = false`, and the order is stored with `is_shipping_quoted = false`.
- `data-export` (admin only) — builds the full filtered CSV for orders, members, point/loyalty/wallet ledgers, redemptions, inventory and payment proofs: UTF-8 BOM, ISO-8601 timestamps, all matching rows regardless of list pagination, and `= + - @` cell prefixes neutralised against formula injection. Every run writes a `DATA_EXPORTED` audit entry.

**Extended**
- `admin-actions` — `create/update_product` (prices, slug, images, type incl. retail/digital, activate), `set_product_stock` / `restock`, bundle CRUD, delivery zone CRUD, payment account CRUD + `verify_payment_account` / `flag_payment_account`, `set_fulfillment` (status, courier, tracking), support ticket manage, notification send, announcement/blog CRUD, `export_data`.
- `member-actions` — notifications list/mark-read, support list/create/reply, profile contact fields.
- `run-required-tests` — extended suite (below).

### 6. Design system — black / deep green / gold / white

`src/index.css` + `tailwind.config.ts` are rewritten as the single source of the identity:
- Tokens `--kmd-black #111111`, `--kmd-green #0B3D2E`, `--kmd-gold #D4AF37`, white.
- Light: white background, `#111111` foreground, deep-green primary, gold accent.
- Dark: `#111111` background, lifted `#161616` cards, white foreground, green/gold accents.
- Gradients `--gradient-hero` (black → green), `--gradient-gold`; shadows `--shadow-gold`, `--shadow-elevated`; `--transition-smooth`.
- Fonts: display face for headings + Inter for body, loaded in `index.html`.
- **Contrast:** gold on white fails AA for body text, so gold is used for large headings, borders, rules and decoration only; body copy stays near-black on white and white on dark. Verified at implementation.
- New button variants (`gold`, `hero`, `outline-light`) so dark hero panels never render invisible outline buttons.
- `kmd-brand-mark`, `kmd-panel` and a new `kmd-dark-panel` refit the existing components, so the member and admin dashboards pick up the new identity without per-page rewrites.

### 7. Routes and pages

**Public** — new `src/components/site/site-shell.tsx` (header with persistent **Shopping Bag** and **Member Area** buttons, announcement bar, footer with contact + socials + policy links):
- `/` home — hero on the brand banner with *Shop Now* and *Become a Member* above the fold, trust strip, best-sellers grid, categories, brand story (GREENCHOYCE, mission, vision, "No Planet B"), product spotlights (Dokudami with disclaimer + MDPI link, PowerPill, LED bulb, KMD Closet, digital services), membership teaser, how-the-5-levels-work, testimonials, knowledge teaser, FAQ, contact CTA.
- `/about`, `/products` (category & best-seller overview), `/shop` (filterable catalogue: search, category, sort, price), `/shop/:slug` (gallery + zoom, regular/promo/savings, stock state, quantity, Add to Cart / Buy Now, description, feature list, disclaimers, shipping note, related items), `/packages`, `/referral-program`, `/testimonials`, `/faqs`, `/knowledge` (education hub incl. the Houttuynia cordata review link), `/blog`, `/blog/:slug`, `/announcements`, `/contact`, `/privacy-policy`, `/terms`, `/refund-policy`.
- `/cart`, `/checkout`, `/order/:orderNumber` (confirmation / tracking), `/track` (guest lookup by order number + email or phone).

**360° view:** only added if a genuine rotation image set exists — the document contains none, so the gallery ships with zoom and the site makes **no 360 claim**.

**Member** — adds `/app/support`, notifications bell in the shell header.
**Admin** — adds `/admin/inventory`, `/admin/catalog` (extends products), `/admin/bundles`, `/admin/delivery-zones`, `/admin/payment-accounts`, `/admin/support`, `/admin/notifications`, `/admin/announcements`, `/admin/blog`, `/admin/readiness`; orders gain fulfilment controls; exports added to orders, members, point/loyalty transactions, redemptions, inventory.

New frontend modules: `src/contexts/cart-context.tsx` (`useCart`), `src/components/site/*` (`site-header`, `site-footer`, `announcement-bar`, `product-card`, `price-tag`, `stock-badge`, `quantity-stepper`, `cart-drawer`, `payment-options`, `proof-upload`), `src/lib/site/content.ts` (FAQ, policy, about and knowledge copy), `src/lib/site/csv.ts`.

### 8. Content and compliance rules (applied everywhere)

- Dokudami is a **food supplement**; supplement + "no diagnostic, treatment, cure or prevention claim" disclaimer on the product page, spotlight and checkout note.
- PowerPill carries its performance-variability disclaimer.
- The cancer-outcome testimonial is **not published**. The three safe testimonials (PowerPill, LED bulb, website design) are published with attribution.
- The document's "Watch the videos" block is **omitted** — no video assets were supplied, and a placeholder that promises videos would be a false claim. It is listed as a readiness item.
- Consent checkbox on registration and guest checkout links to the privacy policy.
- Return & Refund and Terms pages state published rules only, without inventing guarantees.

### 9. i18n
The storefront needs an English / Filipino toggle. `i18n_enable` is invoked first (per the i18n rule), then `enter_i18n` owns the work: add `fil`, keep `en` as fallback, and drop the leftover `zh-CN` locale that belongs to no part of this business.

### 10. Tests
`seed-test-environment` gains TEST customer/retailer accounts and orders for each required
scenario, all `is_test = true` and excluded from production balances.
`run-required-tests` gains: level 2–5 benefits and commission attribution; Level 3–5
values now non-zero and posting correctly; **Loyalty Credits at levels 2–5 always zero**;
`DOK-REORDER` exact-code resolution paying 10/5/5/5/5 with 0 loyalty; customer purchase
triggers unilevel when configured and stays neutral when not; oversell rejected
(concurrent reservation beyond stock, atomic, nothing written); unconfigured shipping zone
blocks checkout; client-supplied price tampering rejected; rejected/cancelled order
releases stock and posts no reward; idempotent double-confirmation still single-payment.
Results land in `test_results` and surface on the existing Verification Report page with a
`PASS / FAIL / NOT RUN` verdict **plus evidence**, never a pass without a check behind it.

---

## Assumptions and open items

1. **Shipping fees are still outstanding.** Luzon / Visayas / Mindanao are seeded with
   `is_configured = false`, so checkout shows "shipping quote pending" instead of inventing
   a charge. Give me the three amounts (and any free-shipping threshold) and I apply them;
   otherwise the owner enters them on `/admin/delivery-zones`.
2. The five membership packages remain ₱0. The document never prices them, so this is
   flagged as a required readiness item rather than guessed.
3. `DOK-REORDER` is treated as **one** product — the sellable Dokudami Capsules SKU. If the
   owner wants a separate reorder-only SKU, that is a one-line change.
4. Retail SKUs ship reward-neutral, per "products with no configured values must remain
   reward-neutral". Configure them in Reward Configuration if a retail purchase should
   pay.
5. Membership bundles and retail items share one catalogue and one checkout; the document
   shows a single "Shop Now → Payment Options → proof upload" path.
6. No newsletter/email sending is built (no mail service is connected); the contact form
   and support tickets write to the backend and notify admins in-app.

---

## Implementation checklist

**Data & backend**
- [ ] Migration `migration_20261007_1_commerce.sql` applies cleanly: new tables, additive `products`/`orders`/`payment_proofs` columns, widened `product_type` check, `loyalty_beneficiary_level = 1` check.
- [ ] `products` price trigger keeps `selling_price = coalesce(promo_price, regular_price, selling_price)` on insert and update.
- [ ] Six retail/digital products seeded with exact codes and document prices; Dokudami row retargeted to `product_code = 'DOK-REORDER'`.
- [ ] Reward matrix applied to all five products (L1–L5 + loyalty) through the audited path; retail rows reward-neutral.
- [ ] `system_settings` seeded with site contact, social, mission/vision, announcement, `stock_reservation_hours`, `bundle_reward_policy`, `policy_version`.
- [ ] Three delivery zones seeded (`Luzon`, `Visayas`, `Mindanao`) with `is_configured = false`.
- [ ] Seven complete payment accounts imported `is_verified = true`; three masked GCash plus MariBank and BPI imported `is_verified = false` with a specific `flag_reason`.
- [ ] RLS on every new table: public read limited to active/verified catalogue rows, admin-only everywhere else.
- [ ] Three storage buckets created with read/write policies.
- [ ] Engine guard rejects any Loyalty Credit at level > 1.
- [ ] `storefront-catalog` returns catalogue, zones, verified accounts and public settings for an anonymous caller.
- [ ] `checkout-actions.place_order` re-prices server-side, reserves stock under `FOR UPDATE`, and rejects oversell atomically.
- [ ] `checkout-actions.quote` returns `SHIPPING_NOT_CONFIGURED` for an unconfigured zone and the order records `is_shipping_quoted = false`.
- [ ] `checkout-actions.submit_proof` accepts a guest or member proof and leaves the order awaiting verification.
- [ ] `checkout-actions.track_order` returns status and amounts only for a matching order number plus email, phone or access token.
- [ ] `admin-actions` covers product, stock, bundle, zone, payment account, fulfilment, ticket, notification, announcement and blog management, each audited.
- [ ] `data-export` returns full filtered CSV with formula-injection neutralisation and writes a `DATA_EXPORTED` audit entry.
- [ ] `seed-test-environment` seeds TEST customer, retailer and scenario orders flagged `is_test`.

**Brand & design system**
- [ ] `src/index.css` and `tailwind.config.ts` carry the black/green/gold/white tokens, gradients, shadows, fonts and utilities.
- [ ] Gold-on-white and green-on-black text pairs verified against WCAG AA; body copy never uses gold.
- [ ] `kmd-brand-mark`, `kmd-panel`, `kmd-dark-panel` and the header/footer use only semantic tokens (no `text-white`/`bg-black`).
- [ ] Button variants added for dark and gold surfaces so outline buttons stay legible.
- [ ] Logo and hero banner extracted from the document, visually confirmed, and used in site header, footer and hero.
- [ ] Member and admin shells re-skinned in the new identity.

**Public site**
- [ ] `SiteShell` renders header (Shopping Bag, Member Area, mobile drawer, language toggle), announcement bar and footer (contact, socials, policy links).
- [ ] `/` renders hero with working Shop Now and Become a Member actions above the fold.
- [ ] `/shop` filters by search, category, sort and price with a working empty state.
- [ ] `/shop/:slug` shows regular price struck through, promo price, savings, stock state, quantity and a working Add to Cart.
- [ ] Every product page carries the correct disclaimer, and the Dokudami page presents it as a food supplement with the MDPI education link.
- [ ] `/products`, `/about`, `/packages`, `/referral-program`, `/testimonials`, `/faqs`, `/knowledge`, `/blog`, `/blog/:slug`, `/announcements`, `/contact` render real content, no lorem ipsum.
- [ ] `/privacy-policy`, `/terms`, `/refund-policy` render.
- [ ] Cancer-outcome testimonial absent from the codebase; the three safe testimonials published.
- [ ] Cart persists across reload and across guest → register → login.
- [ ] `/checkout` collects guest name, phone and email, validates them, and prefills for a signed-in member.
- [ ] Checkout computes and displays shipping from the selected zone, or "shipping quote pending" when unconfigured.
- [ ] Payment options list only verified accounts, with copy-to-clipboard and QR where available.
- [ ] Proof upload accepts image/PDF within the size limit and rejects other types.
- [ ] Placing an order lands on a confirmation page showing "Awaiting payment verification" with the order number.
- [ ] `/track` retrieves a guest order with the correct credentials and refuses wrong ones.
- [ ] Homepage and every storefront page keep Shop Now / Member Area reachable at all breakpoints.
- [ ] Footer contact numbers, emails, Facebook, YouTube, TikTok and Instagram match the document exactly.

**Admin & member**
- [ ] `/admin/catalog` and `/admin/products` create and edit products with prices, images, slug, type and activation.
- [ ] `/admin/inventory` shows on-hand, reserved, available and low-stock, and applies audited adjustments and restocks.
- [ ] `/admin/delivery-zones` edits fees, thresholds and `is_configured`, and saving a fee unblocks checkout.
- [ ] `/admin/payment-accounts` lists all accounts, one-click verifies or flags, and a newly verified account appears at checkout.
- [ ] `/admin/orders` sets fulfilment status, courier and tracking number, and the change is visible to the customer.
- [ ] `/admin/support` and `/app/support` exchange ticket messages, with internal notes hidden from customers.
- [ ] `/admin/readiness` lists unconfigured zones, ₱0 package prices, unverified accounts, missing images and reward-neutral products, each linking to its fix.
- [ ] Exports on each list page download a complete CSV for the active filters.
- [ ] Notifications are created on payment confirmed, payment rejected, order shipped, redemption reviewed and ticket reply, and the bell shows unread counts.
- [ ] `/admin/announcements` and `/admin/blog` publish content that appears on the public site.
- [ ] Member shell gains a support entry and a notifications bell.

**i18n**
- [ ] `i18n_enable` invoked, then English and Filipino exposed through the existing language switcher with `en` fallback.

**Suite**
- [ ] `run-required-tests` extended with the new scenarios and reporting PASS / FAIL / NOT RUN with evidence.

---

## Verification checklist

**Positive paths**
- [ ] `pnpm run check` (lint + `tsc --noEmit`) passes, and `pnpm run build` succeeds.
- [ ] Guest journey end to end: add Dokudami to cart → checkout with name/phone/email → choose a verified method → upload proof → confirmation shows "Awaiting payment verification" → `/track` finds it.
- [ ] Admin confirms the guest order's payment → status becomes confirmed, rewards post for any member buyer, stock moves from reserved to sold.
- [ ] Member journey: signed-in member buys `DOK-REORDER` → level 1–5 points post exactly 10/5/5/5/5 and no Loyalty Credit is created.
- [ ] Classic bundle purchase posts 300/40/20/10/10 plus 2 Loyalty Credits to level 1 only.
- [ ] A newly verified payment account appears at checkout without a redeploy.

**Negative / default paths**
- [ ] Order created but not confirmed returns `NOT_QUALIFIED` and posts nothing.
- [ ] Second confirmation of the same order returns `ALREADY_PROCESSED` with the ledger unchanged.
- [ ] Order with an unknown or tampered SKU/price is rejected and writes no ledger entry.
- [ ] A zone with `is_configured = false` blocks checkout with "shipping quote pending" and creates no order.
- [ ] `/track` with a wrong email or phone returns nothing.
- [ ] An unverified payment account is absent from checkout and from the anonymous catalogue response.
- [ ] The cancer-outcome testimonial is not present anywhere in `src/`.

**Boundary / regression**
- [ ] Concurrency: two simultaneous checkouts on the last unit — exactly one order is created and stock never goes negative.
- [ ] Rejecting or cancelling an order releases its reservation and leaves zero reward rows.
- [ ] A product with all-zero reward config creates no ledger entries when purchased.
- [ ] Retail and membership items in one cart price, ship and reward correctly.
- [ ] Mobile 390 px and desktop 1280 px: header CTAs, catalogue grid, product page and checkout render without overflow (verified with `website_screenshot`).
- [ ] All required suite tests report PASS / FAIL / NOT RUN with evidence on the Verification Report page.
- [ ] Full required suite run recorded in `test_results` against the live backend.
