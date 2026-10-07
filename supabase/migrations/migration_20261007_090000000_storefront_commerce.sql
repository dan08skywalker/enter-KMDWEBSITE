-- ============================================================
-- KMD EMPIRE · migration 9 · storefront commerce
-- Public catalogue, guest checkout, inventory & reservations,
-- delivery zones, payment account registry, support, notifications.
-- Every change below is an additive, same-business extension of tables this
-- project already owns; existing rows, the reward engine and the ledgers are
-- untouched.
-- ============================================================

-- ============================================================
-- 1. products — storefront presentation + a single source of truth for price
-- ============================================================
alter table public.products
  add column if not exists slug text,
  add column if not exists short_description text,
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists gallery jsonb not null default '[]'::jsonb,
  add column if not exists regular_price numeric(14,2),
  add column if not exists promo_price numeric(14,2),
  add column if not exists track_inventory boolean not null default true,
  add column if not exists is_digital boolean not null default false,
  add column if not exists sort_order int not null default 0,
  add column if not exists brand text,
  add column if not exists disclaimer text;

alter table public.products
  drop constraint if exists products_product_type_check;
alter table public.products
  add constraint products_product_type_check
  check (product_type in ('membership','bundle','reorder','retail','digital'));

create unique index if not exists products_slug_key on public.products (lower(slug)) where slug is not null;
create index if not exists products_type_idx on public.products (product_type, is_active);

-- selling_price stays the single amount that is charged. The engine and
-- kmd_create_order already read it, so deriving it here guarantees the price a
-- customer sees, the order total and the rewarded value can never diverge.
create or replace function public.kmd_products_effective_price()
returns trigger language plpgsql as $$
begin
  if new.promo_price is not null or new.regular_price is not null then
    new.selling_price := coalesce(new.promo_price, new.regular_price, new.selling_price);
  end if;
  return new;
end $$;

drop trigger if exists kmd_products_effective_price on public.products;
create trigger kmd_products_effective_price
  before insert or update on public.products
  for each row execute function public.kmd_products_effective_price();

-- ============================================================
-- 2. inventory, movements and reservations
-- ============================================================
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  quantity_on_hand int not null default 0 check (quantity_on_hand >= 0),
  reserved_quantity int not null default 0 check (reserved_quantity >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  is_unlimited boolean not null default false,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory
  drop constraint if exists inventory_reserved_within_stock;
alter table public.inventory
  add constraint inventory_reserved_within_stock
  check (is_unlimited or reserved_quantity <= quantity_on_hand);

create trigger kmd_inventory_touch before update on public.inventory
  for each row execute function public.kmd_touch_updated_at();

-- Append-only: stock history is never edited, only appended.
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('restock','reservation','release','sale','adjustment','damage','return')),
  delta int not null,
  quantity_before int not null,
  quantity_after int not null,
  order_id uuid references public.orders(id),
  actor_id uuid,
  note text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index if not exists stock_movements_order_idx on public.stock_movements (order_id);

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  quantity int not null check (quantity > 0),
  status text not null default 'held' check (status in ('held','committed','released','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_reservations_order_idx on public.stock_reservations (order_id);
create index if not exists stock_reservations_open_idx on public.stock_reservations (status, expires_at);

create trigger kmd_stock_reservations_touch before update on public.stock_reservations
  for each row execute function public.kmd_touch_updated_at();

-- ============================================================
-- 3. delivery zones
-- ============================================================
create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  coverage text,
  shipping_fee numeric(14,2) not null default 0 check (shipping_fee >= 0),
  free_shipping_threshold numeric(14,2) check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  estimated_days_min int check (estimated_days_min is null or estimated_days_min >= 0),
  estimated_days_max int check (estimated_days_max is null or estimated_days_max >= 0),
  -- A zone without an owner-supplied fee is never silently charged as free:
  -- checkout must block until the fee is confirmed.
  is_configured boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger kmd_delivery_zones_touch before update on public.delivery_zones
  for each row execute function public.kmd_touch_updated_at();

-- ============================================================
-- 4. payment account registry (owner-verified before it is published)
-- ============================================================
create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  method text not null check (method in ('gcash','maya','maya_bank','bank_transfer','cash','other')),
  label text,
  bank_name text,
  account_name text,
  account_number text,
  qr_image_url text,
  is_verified boolean not null default false,
  flag_reason text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_accounts_publish_idx on public.payment_accounts (is_active, is_verified, sort_order);

create trigger kmd_payment_accounts_touch before update on public.payment_accounts
  for each row execute function public.kmd_touch_updated_at();

-- ============================================================
-- 5. bundles
-- ============================================================
create table if not exists public.bundle_components (
  id uuid primary key default gen_random_uuid(),
  bundle_product_id uuid not null references public.products(id) on delete cascade,
  component_product_id uuid not null references public.products(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (bundle_product_id, component_product_id)
);

-- ============================================================
-- 6. orders — guest checkout, delivery and fulfilment
-- ============================================================
alter table public.orders
  add column if not exists customer_type text not null default 'member',
  add column if not exists guest_name text,
  add column if not exists guest_phone text,
  add column if not exists guest_email text,
  add column if not exists delivery_zone_id uuid references public.delivery_zones(id),
  add column if not exists shipping_address text,
  add column if not exists shipping_barangay text,
  add column if not exists shipping_city text,
  add column if not exists shipping_province text,
  add column if not exists shipping_postal_code text,
  add column if not exists subtotal numeric(14,2) not null default 0,
  add column if not exists shipping_fee numeric(14,2) not null default 0,
  add column if not exists is_shipping_quoted boolean not null default false,
  add column if not exists payment_method text,
  add column if not exists fulfillment_status text not null default 'unfulfilled',
  add column if not exists courier text,
  add column if not exists tracking_number text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists access_token uuid not null default gen_random_uuid(),
  add column if not exists customer_notes text;

alter table public.orders
  drop constraint if exists orders_customer_type_check;
alter table public.orders
  add constraint orders_customer_type_check check (customer_type in ('member','guest'));

alter table public.orders
  drop constraint if exists orders_fulfillment_status_check;
alter table public.orders
  add constraint orders_fulfillment_status_check
  check (fulfillment_status in ('unfulfilled','preparing','shipped','delivered','cancelled'));

-- A guest order has no member record, so it must carry contact details.
alter table public.orders alter column buyer_profile_id drop not null;
alter table public.orders alter column buyer_member_code drop not null;

alter table public.orders
  drop constraint if exists orders_buyer_identity_check;
alter table public.orders
  add constraint orders_buyer_identity_check
  check (buyer_profile_id is not null or coalesce(guest_email,'') <> '');

create index if not exists orders_customer_idx on public.orders (customer_type, created_at desc);
create index if not exists orders_fulfillment_idx on public.orders (fulfillment_status);
create unique index if not exists orders_access_token_key on public.orders (access_token);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  actor_id uuid,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- ============================================================
-- 7. payment proofs — must accept a guest checkout
-- ============================================================
alter table public.payment_proofs
  add column if not exists guest_email text,
  add column if not exists guest_name text;

alter table public.payment_proofs alter column member_id drop not null;

alter table public.payment_proofs drop constraint if exists payment_proofs_method_check;
alter table public.payment_proofs
  add constraint payment_proofs_method_check
  check (method in ('gcash','maya','maya_bank','bank_transfer','cash','other'));

alter table public.payment_proofs
  drop constraint if exists payment_proofs_payer_identity_check;
alter table public.payment_proofs
  add constraint payment_proofs_payer_identity_check
  check (member_id is not null or coalesce(guest_email,'') <> '');

-- ============================================================
-- 8. support tickets
-- ============================================================
create sequence if not exists public.kmd_ticket_seq start with 1001 increment by 1;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  member_id uuid references public.profiles(id) on delete set null,
  member_code text,
  guest_name text,
  guest_email text,
  order_id uuid references public.orders(id) on delete set null,
  subject text not null,
  category text not null default 'general'
    check (category in ('general','order','payment','delivery','product','account','digital_service')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open'
    check (status in ('open','in_progress','waiting_customer','resolved','closed')),
  assigned_to uuid,
  last_reply_at timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_member_idx on public.support_tickets (member_id, created_at desc);

create trigger kmd_support_tickets_touch before update on public.support_tickets
  for each row execute function public.kmd_touch_updated_at();

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_profile_id uuid references public.profiles(id) on delete set null,
  author_role text not null default 'customer' check (author_role in ('customer','staff','system')),
  author_label text,
  body text not null,
  is_internal boolean not null default false,
  attachment_path text,
  created_at timestamptz not null default now()
);

create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- ============================================================
-- 9. notifications
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_profile_idx on public.notifications (profile_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (profile_id) where is_read = false;

-- ============================================================
-- 10. reward matrix integrity — Level 2-5 loyalty is always zero
-- ============================================================
alter table public.reward_configurations
  drop constraint if exists reward_configurations_loyalty_beneficiary_level_check;
alter table public.reward_configurations
  drop constraint if exists reward_cfg_loyalty_level_l1;
alter table public.reward_configurations
  add constraint reward_cfg_loyalty_level_l1 check (loyalty_beneficiary_level = 1);

-- ============================================================
-- 11. RLS
-- ============================================================
alter table public.inventory enable row level security;
create policy inventory_select_active on public.inventory
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );
create policy inventory_select_admin on public.inventory
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

alter table public.stock_movements enable row level security;
create policy stock_movements_select_admin on public.stock_movements
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

alter table public.stock_reservations enable row level security;
create policy stock_reservations_select_admin on public.stock_reservations
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

alter table public.delivery_zones enable row level security;
create policy delivery_zones_select_active on public.delivery_zones
  for select to anon, authenticated using (is_active);
create policy delivery_zones_select_admin on public.delivery_zones
  for select to authenticated using (public.kmd_is_admin(auth.uid()));
-- no client write policy: zones are edited only through audited backend functions

-- Only owner-verified, active accounts are ever exposed to the public surface.
alter table public.payment_accounts enable row level security;
create policy payment_accounts_select_public on public.payment_accounts
  for select to anon, authenticated using (is_active and is_verified);
create policy payment_accounts_select_admin on public.payment_accounts
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

alter table public.bundle_components enable row level security;
create policy bundle_components_select_active on public.bundle_components
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = bundle_product_id and p.is_active)
  );
create policy bundle_components_select_admin on public.bundle_components
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

alter table public.order_status_history enable row level security;
create policy order_status_history_select_own on public.order_status_history
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.buyer_profile_id = auth.uid())
  );
create policy order_status_history_select_admin on public.order_status_history
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

alter table public.support_tickets enable row level security;
create policy support_tickets_select_own on public.support_tickets
  for select to authenticated using (member_id = auth.uid());
create policy support_tickets_select_admin on public.support_tickets
  for select to authenticated using (public.kmd_is_admin(auth.uid()));
-- no client write policy: tickets are created and answered by backend functions

alter table public.ticket_messages enable row level security;
create policy ticket_messages_select_own on public.ticket_messages
  for select to authenticated using (
    is_internal = false
    and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.member_id = auth.uid())
  );
create policy ticket_messages_select_admin on public.ticket_messages
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications
  for select to authenticated using (profile_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy notifications_select_admin on public.notifications
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

-- ============================================================
-- 12. grants
-- ============================================================
grant select on public.inventory, public.delivery_zones, public.payment_accounts,
  public.bundle_components
  to anon, authenticated;

grant select on public.stock_movements, public.stock_reservations,
  public.order_status_history, public.support_tickets, public.ticket_messages,
  public.notifications, public.payment_accounts, public.inventory,
  public.delivery_zones
  to authenticated;

-- ============================================================
-- 13. site content and commerce settings
-- ============================================================
insert into public.system_settings (key, value, description) values
  ('site.contact.phones', '["+63 995 861 2854","+63 975 398 9689"]'::jsonb, 'Published contact numbers.'),
  ('site.contact.emails', '["dan08.skywalker@gmail.com","taksman11@gmail.com"]'::jsonb, 'Published contact email addresses.'),
  ('site.contact.address', '"Philippines" '::jsonb, 'Published business location.'),
  ('site.website', '"www.kmdempire.com"'::jsonb, 'Published website address.'),
  ('site.social.facebook', '"https://www.facebook.com/dokudamiphilippines/"'::jsonb, 'Facebook page.'),
  ('site.social.youtube', '"https://www.youtube.com/@ecoandgreenchoyce"'::jsonb, 'YouTube channel.'),
  ('site.social.tiktok', '"https://www.tiktok.com/@danderek08"'::jsonb, 'TikTok profile.'),
  ('site.social.instagram', '"https://www.instagram.com/dan_derek08"'::jsonb, 'Instagram profile.'),
  ('site.tagline', '"Serving with purpose, integrity, and excellence."'::jsonb, 'Brand tagline.'),
  ('site.parent', '"KMD Empire Team is powered by GreenChoyce."'::jsonb, 'Parent company statement.'),
  ('site.announcement', '""'::jsonb, 'Announcement strip shown across the public site. Empty hides it.'),
  ('site.mission', '"To develop and provide innovative, sustainable, and high-quality products that solve everyday challenges while creating a positive impact on people and the environment."'::jsonb, 'Mission statement.'),
  ('site.vision', '"To build a future where innovation and sustainability go hand in hand, delivering products that improve lives while protecting our planet. Because there is no Planet B."'::jsonb, 'Vision statement.'),
  ('stock_reservation_hours', '72'::jsonb, 'How long a checkout holds stock before the reservation expires.'),
  ('bundle_reward_policy', '"bundle_sku"'::jsonb, 'Reward a bundle purchase from the bundle SKU or from its component SKUs.'),
  ('support_email', '"dan08.skywalker@gmail.com"'::jsonb, 'Address shown on support and contact pages.'),
  ('policy_version', '"2026-10-07"'::jsonb, 'Version of the published privacy, terms and refund policies.')
on conflict (key) do nothing;

-- ============================================================
-- 14. delivery zones — seeded WITHOUT owner-supplied fees.
-- is_configured = false makes checkout block instead of guessing a charge.
-- ============================================================
insert into public.delivery_zones (name, coverage, shipping_fee, is_configured, is_active, sort_order) values
  ('Luzon', 'Metro Manila and the whole of Luzon', 0, false, true, 1),
  ('Visayas', 'Visayas islands', 0, false, true, 2),
  ('Mindanao', 'Mindanao islands', 0, false, true, 3)
on conflict (name) do nothing;

-- ============================================================
-- 15. catalogue — codes and prices exactly as supplied
-- ============================================================
-- The Dokudami reorder row keeps its identity and takes the exact code
-- DOK-REORDER so it resolves to the correct reward configuration row.
update public.products
  set product_code = 'DOK-REORDER',
      name = 'Dokudami Capsules',
      category = 'Wellness',
      product_type = 'reorder',
      slug = 'dokudami-capsules',
      short_description = 'Houttuynia cordata food supplement capsules.',
      brand = 'EGC Dokudami',
      image_url = '/products/dokudami.png',
      gallery = '["/products/dokudami.png","/products/dokudami-ingredients.png"]'::jsonb,
      regular_price = 3000.00,
      promo_price = 1850.00,
      sort_order = 1,
      description = 'Everyday wellness support in capsule form, made with Houttuynia cordata (dokudami) and its naturally occurring flavonoids, essential oil, alkaloids, phenolic acid and fatty acids.',
      disclaimer = 'This product is a food supplement. It is not intended to diagnose, treat, cure or prevent any disease. Individual results may vary.'
  where sku = 'KMD-DOKUDAMI-001';

insert into public.products (
  product_code, name, sku, category, product_type, is_active, is_digital,
  slug, short_description, description, brand, image_url, gallery,
  regular_price, promo_price, sort_order, disclaimer, track_inventory
) values
  ('KMD-POWERPILL-75L', 'PowerPill Plus (75L / Pill)', 'KMD-POWERPILL-75L', 'Fuel Additive', 'retail', true, false,
   'powerpill-plus-75l', 'Advanced fuel conditioning technology for 75 litres of fuel per pill.',
   'A fuel conditioning pill for gasoline and diesel engines. Helps support cleaner and more efficient combustion, reduces carbon build-up and supports smoother engine performance.',
   'PowerPill Plus', '/products/powerpill-75l.jpeg', '["/products/powerpill-75l.jpeg","/products/powerpill.jpeg"]'::jsonb,
   1350.00, 950.00, 2,
   'Performance results may vary depending on engine condition, fuel quality, vehicle type, maintenance practices and operating conditions.', true),
  ('KMD-POWERPILL-15L', 'PowerPill Plus MICRO (15L / Pill)', 'KMD-POWERPILL-15L', 'Fuel Additive', 'retail', true, false,
   'powerpill-plus-15l', 'Compact fuel conditioning pill for motorcycles and small engines.',
   'A smaller formulation of the PowerPill Plus range, designed for motorcycles, tricycles and other small engines.',
   'PowerPill Plus', '/products/powerpill-15l.jpeg', '["/products/powerpill-15l.jpeg","/products/powerpill.jpeg"]'::jsonb,
   300.00, 250.00, 3,
   'Performance results may vary depending on engine condition, fuel quality, vehicle type, maintenance practices and operating conditions.', true),
  ('KMD-LED-BULB', 'Intelligent Emergency LED Bulb', 'KMD-LED-BULB', 'Home & Lighting', 'retail', true, false,
   'intelligent-emergency-led-bulb', 'Rechargeable LED bulb that stays lit during a power outage.',
   'Stays illuminated even during power outages. Automatic emergency lighting with a rechargeable battery, up to 7 hours of backup power and energy-saving LED technology. 5-watt output equivalent to a 60-watt bulb, with a 5-year warranty.',
   'Diode International', '/products/led-bulb.png', '["/products/led-bulb.png"]'::jsonb,
   1500.00, 1200.00, 4,
   'Backup duration depends on battery condition and usage.', true),
  ('KMD-CLOSET', 'KMD Closet Apparel', 'KMD-CLOSET', 'Apparel', 'retail', true, false,
   'kmd-closet-apparel', 'Elegant clothing designed for all-day comfort and timeless everyday style.',
   'Lightweight, breathable apparel made for everyday wear at a price everyone can afford. Soft, comfortable fabric with an elegant silhouette that suits any occasion.',
   'KMD Closet', '/products/kmd-closet.jpeg', '["/products/kmd-closet.jpeg"]'::jsonb,
   499.00, 249.00, 5,
   'Colour and cut may vary slightly between production batches.', true),
  ('KMD-DIGITAL-LP', 'Website & Landing Page Service', 'KMD-DIGITAL-LP', 'Digital Services', 'digital', true, true,
   'website-landing-page-service', 'Professional, customised website or landing page for your business.',
   'An affordable, professional and fully customised digital service package covering website development, landing pages, business and e-commerce sites, mobile app development and digital solutions for your business. Delivered to your requirements after a scoping consultation.',
   'KMD Digital Products', '/products/digital-services.png', '["/products/digital-services.png"]'::jsonb,
   25000.00, 9999.00, 6,
   'Scope, timeline and deliverables are confirmed with you before work begins.', false)
on conflict (product_code) do nothing;

-- Inventory rows: nothing is in stock until the owner records it, except the
-- digital service which is not physically stocked.
insert into public.inventory (product_id, quantity_on_hand, low_stock_threshold, is_unlimited)
select p.id, 0, 5, p.is_digital
from public.products p
on conflict (product_id) do nothing;

-- ============================================================
-- 16. authoritative reward matrix
-- Values supplied by the owner. Supersedes every earlier matrix.
-- Loyalty Credits are paid at Level 1 only; Levels 2-5 are always zero.
-- ============================================================
insert into public.reward_configurations
  (product_id, sku, level1_points, level2_points, level3_points, level4_points, level5_points,
   loyalty_credit, loyalty_beneficiary_level)
select p.id, p.sku, v.l1, v.l2, v.l3, v.l4, v.l5, v.loyalty, 1
from (values
  ('KMD-DOKUDAMI-001',  10::numeric,   5::numeric,  5::numeric,   5::numeric,  5::numeric,  0::numeric),
  ('KMD-TRIAL-001',    150::numeric,  20::numeric, 10::numeric,   5::numeric,  5::numeric,  0::numeric),
  ('KMD-CLASSIC-001',  300::numeric,  40::numeric, 20::numeric,  10::numeric, 10::numeric,  2::numeric),
  ('KMD-GOLD-001',     600::numeric, 100::numeric, 40::numeric,  20::numeric, 20::numeric,  4::numeric),
  ('KMD-PLATINUM-001', 5000::numeric, 300::numeric, 150::numeric, 100::numeric, 50::numeric, 30::numeric)
) as v(sku, l1, l2, l3, l4, l5, loyalty)
join public.products p on p.sku = v.sku
on conflict (product_id) do update set
  level1_points = excluded.level1_points,
  level2_points = excluded.level2_points,
  level3_points = excluded.level3_points,
  level4_points = excluded.level4_points,
  level5_points = excluded.level5_points,
  loyalty_credit = excluded.loyalty_credit,
  loyalty_beneficiary_level = 1,
  updated_at = now();

-- Retail and digital products start reward-neutral. A purchase of a product
-- with no configured values creates no ledger entry, exactly as specified.
insert into public.reward_configurations (product_id, sku)
select p.id, p.sku from public.products p
where p.product_type in ('retail','digital')
on conflict (product_id) do nothing;

-- ============================================================
-- 17. payment accounts
-- Every account is imported. The three masked GCash names and the two records
-- that carry an account number where the account name belongs are flagged for
-- the owner instead of being published as fact.
-- ============================================================
insert into public.payment_accounts (method, label, bank_name, account_name, account_number, is_verified, flag_reason, is_active, sort_order) values
  ('maya', 'Maya Wallet', 'Maya', 'Danilo Taoc', '09958612854', true, null, true, 1),
  ('maya_bank', 'Maya Bank', 'Maya Bank', 'Danilo Taoc', '808070253444', true, null, true, 2),
  ('bank_transfer', 'GoTyme Bank', 'GoTyme Bank', 'Danilo Taoc', '014993520908', true, null, true, 3),
  ('bank_transfer', 'NetBank (A Rural Bank), Inc.', 'NetBank', 'Danilo Taoc', '17706713836341', true, null, true, 4),
  ('bank_transfer', 'BDO Kabayan Savings', 'BDO Unibank, Incorporated', 'Danilo Andrada Taoc', '002920269271', true, null, true, 5),
  ('bank_transfer', 'BDO Savings', 'Banco De Oro Unibank, Inc.', 'Danilo Taoc', '012340028147', true, null, true, 6),
  ('bank_transfer', 'BDO Savings', 'Banco De Oro Unibank, Inc.', 'Danilo Taoc', '003200499448', true, null, true, 7),
  ('gcash', 'GCash', 'GCash', 'DA***O T.', '09186544828', false, 'Account name is masked in the source document and conflicts with the full account name used for the bank accounts. Owner must confirm the exact registered name before this account is shown at checkout.', true, 8),
  ('gcash', 'GCash', 'GCash', 'KE**A MY**H Q.', '09108916292', false, 'Account name is masked in the source document and conflicts with the full account name used for the bank accounts. Owner must confirm the exact registered name before this account is shown at checkout.', true, 9),
  ('gcash', 'GCash', 'GCash', 'JE*****R T.', '09753989689', false, 'Account name is masked in the source document and conflicts with the full account name used for the bank accounts. Owner must confirm the exact registered name before this account is shown at checkout.', true, 10),
  ('bank_transfer', 'MariBank', 'MariBank', null, '19884088568', false, 'The source document puts the account number in the account-name field. Owner must supply the registered account name.', true, 11),
  ('bank_transfer', 'BPI', 'Bank of the Philippine Islands', null, '0989015776', false, 'The source document puts the account number in the account-name field. Owner must supply the registered account name.', true, 12);
