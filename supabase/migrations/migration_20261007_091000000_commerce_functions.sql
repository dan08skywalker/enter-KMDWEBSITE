-- ============================================================
-- KMD EMPIRE · migration 10 · storefront & commerce functions
-- Catalogue reads, guest checkout with atomic stock reservation, payment
-- proof submission, order tracking, support, notifications, exports.
-- ============================================================

-- ============================================================
-- 1. content posts (blog, news, announcements, knowledge centre)
-- ============================================================
create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text,
  category text not null default 'blog'
    check (category in ('blog','news','announcement','knowledge')),
  cover_image_url text,
  link_url text,
  is_published boolean not null default false,
  is_pinned boolean not null default false,
  published_at timestamptz,
  author_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_posts_feed_idx on public.content_posts (category, is_published, published_at desc);

create trigger kmd_content_posts_touch before update on public.content_posts
  for each row execute function public.kmd_touch_updated_at();

alter table public.content_posts enable row level security;

drop policy if exists content_posts_select_published on public.content_posts;
create policy content_posts_select_published on public.content_posts
  for select to anon, authenticated using (is_published);
drop policy if exists content_posts_select_admin on public.content_posts;
create policy content_posts_select_admin on public.content_posts
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

grant select on public.content_posts to anon, authenticated;

-- ============================================================
-- 2. notification helper
-- ============================================================
-- Parses a client-supplied identifier without ever raising: an invalid value
-- returns null instead of aborting the surrounding checkout call.
create or replace function public.kmd_try_uuid(p_text text)
returns uuid language plpgsql immutable as $$
begin
  if p_text is null
     or p_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return null;
  end if;
  return p_text::uuid;
end $$;

create or replace function public.kmd_notify(
  p_profile uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_profile is null then
    return null;
  end if;
  insert into public.notifications (profile_id, type, title, body, link, metadata)
  values (p_profile, p_type, p_title, p_body, p_link, coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

-- ============================================================
-- 3. public settings (safe subset only)
-- ============================================================
create or replace function public.kmd_settings_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from public.system_settings
  where key like 'site.%';
$$;

-- ============================================================
-- 4. storefront catalogue — one anonymous round trip
-- Only owner-verified payment accounts are ever returned.
-- ============================================================
create or replace function public.kmd_storefront_catalog()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'slug', p.slug, 'sku', p.sku, 'productCode', p.product_code,
        'name', p.name, 'brand', p.brand, 'category', p.category,
        'productType', p.product_type, 'eyebrow', p.short_description,
        'description', p.description, 'disclaimer', p.disclaimer,
        'imageUrl', p.image_url, 'gallery', p.gallery,
        'regularPrice', p.regular_price, 'promoPrice', p.promo_price,
        'effectivePrice', p.selling_price, 'isDigital', p.is_digital,
        'tracksInventory', p.track_inventory,
        'availableQuantity', case
          when p.is_digital then null
          when coalesce(i.is_unlimited,false) then null
          when i.product_id is null then 0
          when i.quantity_on_hand - i.reserved_quantity < 0 then 0
          else i.quantity_on_hand - i.reserved_quantity
        end,
        'inStock', case
          when p.is_digital then true
          when coalesce(i.is_unlimited,false) then true
          else coalesce(i.quantity_on_hand - i.reserved_quantity, 0) > 0
        end,
        'lowStock', case
          when p.is_digital then false
          when coalesce(i.is_unlimited,false) then false
          else coalesce(i.quantity_on_hand - i.reserved_quantity, 0) > 0
               and coalesce(i.quantity_on_hand - i.reserved_quantity, 0) <= coalesce(i.low_stock_threshold, 5)
        end
      ) order by p.sort_order, p.name)
      from public.products p
      left join public.inventory i on i.product_id = p.id
      where p.is_active and p.product_type in ('retail','reorder','digital')
    ), '[]'::jsonb),
    'packages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mp.id, 'code', mp.package_code, 'name', mp.name, 'tier', mp.tier,
        'productName', p.name, 'sku', p.sku,
        'regularPrice', p.regular_price, 'promoPrice', p.promo_price,
        'effectivePrice', p.selling_price,
        'description', p.description
      ) order by mp.package_code)
      from public.membership_packages mp
      join public.products p on p.id = mp.product_id
      where mp.is_active and p.is_active
    ), '[]'::jsonb),
    'deliveryZones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', z.id, 'name', z.name, 'coverage', z.coverage,
        'shippingFee', z.shipping_fee, 'freeShippingThreshold', z.free_shipping_threshold,
        'estimatedDaysMin', z.estimated_days_min, 'estimatedDaysMax', z.estimated_days_max,
        'isConfigured', z.is_configured
      ) order by z.sort_order, z.name)
      from public.delivery_zones z where z.is_active
    ), '[]'::jsonb),
    'paymentAccounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'method', a.method, 'label', a.label, 'bankName', a.bank_name,
        'accountName', a.account_name, 'accountNumber', a.account_number,
        'qrImageUrl', a.qr_image_url
      ) order by a.sort_order, a.id)
      from public.payment_accounts a where a.is_active and a.is_verified
    ), '[]'::jsonb),
    'settings', public.kmd_settings_public()
  );
$$;

create or replace function public.kmd_storefront_product(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object(
      'id', p.id, 'slug', p.slug, 'sku', p.sku, 'name', p.name, 'brand', p.brand,
      'category', p.category, 'productType', p.product_type, 'eyebrow', p.short_description,
      'description', p.description, 'disclaimer', p.disclaimer,
      'imageUrl', p.image_url, 'gallery', p.gallery,
      'regularPrice', p.regular_price, 'promoPrice', p.promo_price,
      'effectivePrice', p.selling_price, 'isDigital', p.is_digital,
      'availableQuantity', case
        when p.is_digital or coalesce(i.is_unlimited,false) then null
        when i.product_id is null then 0
        else greatest(i.quantity_on_hand - i.reserved_quantity, 0) end,
      'inStock', case
        when p.is_digital or coalesce(i.is_unlimited,false) then true
        else coalesce(i.quantity_on_hand - i.reserved_quantity, 0) > 0 end,
      'lowStock', case
        when p.is_digital or coalesce(i.is_unlimited,false) then false
        else coalesce(i.quantity_on_hand - i.reserved_quantity, 0) > 0
             and coalesce(i.quantity_on_hand - i.reserved_quantity, 0) <= coalesce(i.low_stock_threshold, 5) end,
      'etaDays', case when p.is_digital then 'Delivered digitally after payment verification'
                      else 'Dispatched after payment verification' end
    ) from public.products p
    left join public.inventory i on i.product_id = p.id
    where p.is_active and p.slug = p_slug
    limit 1),
    jsonb_build_object('found', false));
$$;

-- ============================================================
-- 5. stock helpers
-- ============================================================
-- Commit a held reservation: stock leaves the shelf only once the purchase is
-- verified to qualify.
create or replace function public.kmd_stock_commit(p_order_id uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_res record;
  v_row public.inventory%rowtype;
  v_after int;
begin
  for v_res in
    select * from public.stock_reservations
    where order_id = p_order_id and status = 'held'
    for update
  loop
    select * into v_row from public.inventory where product_id = v_res.product_id for update;
    if found and not v_row.is_unlimited then
      v_after := greatest(v_row.quantity_on_hand - v_res.quantity, 0);
      update public.inventory
        set quantity_on_hand = v_after,
            reserved_quantity = greatest(v_row.reserved_quantity - v_res.quantity, 0),
            updated_by = p_actor,
            updated_at = now()
        where product_id = v_res.product_id;

      insert into public.stock_movements (product_id, movement_type, delta, quantity_before, quantity_after, order_id, actor_id, note)
      values (v_res.product_id, 'sale', -v_res.quantity, v_row.quantity_on_hand, v_after, p_order_id, p_actor, 'Stock committed on payment confirmation');
    end if;

    update public.stock_reservations set status = 'committed' where id = v_res.id;
  end loop;
end $$;

-- Release a held reservation without any sale: rejecting, cancelling or an
-- abandoned checkout returns the stock to the shelf.
create or replace function public.kmd_stock_release(p_order_id uuid, p_actor uuid default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_res record;
  v_row public.inventory%rowtype;
begin
  for v_res in
    select * from public.stock_reservations
    where order_id = p_order_id and status = 'held'
    for update
  loop
    select * into v_row from public.inventory where product_id = v_res.product_id for update;
    if found and not v_row.is_unlimited then
      update public.inventory
        set reserved_quantity = greatest(v_row.reserved_quantity - v_res.quantity, 0),
            updated_by = p_actor,
            updated_at = now()
        where product_id = v_res.product_id;

      insert into public.stock_movements (product_id, movement_type, delta, quantity_before, quantity_after, order_id, actor_id, note)
      values (v_res.product_id, 'release', v_res.quantity, v_row.quantity_on_hand, v_row.quantity_on_hand, p_order_id, p_actor, coalesce(p_reason,'Stock reservation released'));
    end if;

    update public.stock_reservations set status = 'released' where id = v_res.id;
  end loop;
end $$;

-- ============================================================
-- 6. checkout quote — server-side pricing only
-- ============================================================
create or replace function public.kmd_checkout_quote(p_items jsonb, p_zone_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_inv public.inventory%rowtype;
  v_qty int;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric(14,2) := 0;
  v_needs_shipping boolean := false;
  v_zone public.delivery_zones%rowtype;
  v_shipping numeric(14,2) := 0;
  v_quoted boolean := true;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('status','FAILED','reason','EMPTY_CART','reasonText','Your bag is empty.');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(coalesce((v_item->>'quantity')::int, 0), 0);
    select * into v_product from public.products
      where upper(sku) = upper(trim(coalesce(v_item->>'sku',''))) and is_active;
    if not found then
      return jsonb_build_object('status','FAILED','reason','PRODUCT_NOT_AVAILABLE',
        'reasonText','An item in your bag is no longer available.', 'sku', v_item->>'sku');
    end if;
    if v_qty < 1 then
      return jsonb_build_object('status','FAILED','reason','VALIDATION',
        'reasonText','Quantity must be at least 1 for ' || v_product.name, 'sku', v_product.sku);
    end if;

    select * into v_inv from public.inventory where product_id = v_product.id;
    -- Mirrors place_order: a product with no stock record is treated as out of
    -- stock, so the quote and the order always agree.
    if not v_product.is_digital and v_product.track_inventory
       and (not found or (not v_inv.is_unlimited
            and (v_inv.quantity_on_hand - v_inv.reserved_quantity) < v_qty)) then
      return jsonb_build_object('status','FAILED','reason','INSUFFICIENT_STOCK',
        'reasonText', case when not found then v_product.name || ' is not available right now.'
          else 'Only ' || greatest(v_inv.quantity_on_hand - v_inv.reserved_quantity, 0)
               || ' left of ' || v_product.name end,
        'sku', v_product.sku,
        'available', case when not found then 0
          else greatest(v_inv.quantity_on_hand - v_inv.reserved_quantity, 0) end);
    end if;

    if not v_product.is_digital then
      v_needs_shipping := true;
    end if;

    v_subtotal := v_subtotal + (v_product.selling_price * v_qty);
    v_lines := v_lines || jsonb_build_object(
      'sku', v_product.sku, 'name', v_product.name, 'productId', v_product.id,
      'quantity', v_qty, 'unitPrice', v_product.selling_price,
      'lineTotal', v_product.selling_price * v_qty, 'isDigital', v_product.is_digital,
      'imageUrl', v_product.image_url);
  end loop;

  if not v_needs_shipping then
    v_quoted := true;
  elsif p_zone_id is null then
    v_quoted := false;
  else
    select * into v_zone from public.delivery_zones where id = p_zone_id and is_active;
    if not found then
      return jsonb_build_object('status','FAILED','reason','DELIVERY_ZONE_NOT_FOUND',
        'reasonText','That delivery area is not available.');
    end if;
    if not v_zone.is_configured then
      -- The owner has not supplied this area's fee yet. The order is accepted
      -- and flagged instead of inventing a charge.
      v_quoted := false;
    else
      v_shipping := v_zone.shipping_fee;
      if v_zone.free_shipping_threshold is not null and v_subtotal >= v_zone.free_shipping_threshold then
        v_shipping := 0;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'status','OK',
    'lines', v_lines,
    'subtotal', v_subtotal,
    'shippingFee', v_shipping,
    'shippingQuoted', v_quoted,
    'requiresShipping', v_needs_shipping,
    'total', v_subtotal + v_shipping,
    'zoneName', v_zone.name);
end $$;

-- ============================================================
-- 7. place an order — guest or member, priced and reserved server-side
-- ============================================================
create or replace function public.kmd_checkout_place_order(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_guard jsonb;
  v_lines jsonb;
  v_line jsonb;
  v_product public.products%rowtype;
  v_inv public.inventory%rowtype;
  v_qty int;
  v_order_id uuid;
  v_order_number text;
  v_token uuid;
  v_subtotal numeric(14,2) := 0;
  v_shipping numeric(14,2) := 0;
  v_quoted boolean := true;
  v_zone public.delivery_zones%rowtype;
  v_guest_name text := nullif(trim(coalesce(p_payload->>'contactName','')), '');
  v_guest_phone text := nullif(trim(coalesce(p_payload->>'contactPhone','')), '');
  v_guest_email text := lower(nullif(trim(coalesce(p_payload->>'contactEmail','')), ''));
  v_payment_method text := nullif(trim(coalesce(p_payload->>'paymentMethod','')), '');
  v_reservation_hours numeric;
  v_items jsonb := coalesce(p_payload->'items', '[]'::jsonb);
  v_needs_shipping boolean := false;
  v_is_member boolean := false;
begin
  -- ---- identity: a signed-in member, or a guest with contact details
  if v_uid is not null then
    select * into v_profile from public.profiles where id = v_uid;
    if found then
      v_is_member := true;
      v_guest_name := coalesce(v_guest_name, v_profile.full_name);
      v_guest_phone := coalesce(v_guest_phone, v_profile.mobile_number);
      v_guest_email := coalesce(v_guest_email, lower(v_profile.email));
    else
      v_profile.id := null;
    end if;
  end if;

  -- Contact details are required for every customer, member or guest, so the
  -- confirmation and the delivery can reach them.
  if v_guest_email is null or v_guest_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('status','FAILED','reason','VALIDATION',
      'reasonText','A valid email address is required so we can send your order confirmation.');
  end if;
  if v_guest_name is null then
    return jsonb_build_object('status','FAILED','reason','VALIDATION','reasonText','Your name is required.');
  end if;
  if v_guest_phone is null then
    return jsonb_build_object('status','FAILED','reason','VALIDATION','reasonText','A contact mobile number is required.');
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    return jsonb_build_object('status','FAILED','reason','EMPTY_CART','reasonText','Your bag is empty.');
  end if;

  -- ---- payment method must be an account the owner has verified
  if v_payment_method is not null
     and not exists (select 1 from public.payment_accounts a
                     where a.is_active and a.is_verified and a.method = v_payment_method) then
    return jsonb_build_object('status','FAILED','reason','PAYMENT_METHOD_NOT_AVAILABLE',
      'reasonText','That payment method is not available yet.');
  end if;

  -- ---- validate and lock every line before writing anything.
  -- Items are locked in a deterministic SKU order so two concurrent checkouts
  -- can never deadlock against each other.
  for v_line in
    select value from jsonb_array_elements(v_items) as t(value) order by value->>'sku'
  loop
    v_qty := coalesce((v_line->>'quantity')::int, 0);
    if v_qty < 1 or v_qty > 99 then
      return jsonb_build_object('status','FAILED','reason','VALIDATION',
        'reasonText','Quantity must be between 1 and 99.', 'sku', v_line->>'sku');
    end if;

    select * into v_product from public.products
      where upper(sku) = upper(trim(coalesce(v_line->>'sku',''))) and is_active for update;
    if not found then
      return jsonb_build_object('status','FAILED','reason','PRODUCT_NOT_AVAILABLE',
        'reasonText','An item in your bag is no longer available.', 'sku', v_line->>'sku');
    end if;

    -- Server-side pricing: the client price is never trusted.
    if v_product.selling_price <= 0 then
      return jsonb_build_object('status','FAILED','reason','PRICE_NOT_CONFIGURED',
        'reasonText','The price for ' || v_product.name || ' has not been configured yet. Please contact us to order it.');
    end if;

    if v_product.track_inventory and not v_product.is_digital then
      select * into v_inv from public.inventory where product_id = v_product.id for update;
      -- A product with no stock record is treated as having none: selling is
      -- blocked rather than guessed at.
      if not found or (not v_inv.is_unlimited
         and (v_inv.quantity_on_hand - v_inv.reserved_quantity) < v_qty) then
        return jsonb_build_object('status','FAILED','reason','INSUFFICIENT_STOCK',
          'reasonText', case when not found then v_product.name || ' is not available right now.'
            else 'Only ' || greatest(v_inv.quantity_on_hand - v_inv.reserved_quantity, 0)
                 || ' left of ' || v_product.name || '.' end,
          'sku', v_product.sku,
          'available', case when not found then 0
            else greatest(v_inv.quantity_on_hand - v_inv.reserved_quantity, 0) end);
      end if;
      v_needs_shipping := true;
    end if;

    v_subtotal := v_subtotal + (v_product.selling_price * v_qty);
  end loop;

  -- ---- shipping
  if not v_needs_shipping then
    v_quoted := true;
    v_shipping := 0;
  elsif public.kmd_try_uuid(p_payload->>'deliveryZoneId') is not null then
    select * into v_zone from public.delivery_zones
      where id = public.kmd_try_uuid(p_payload->>'deliveryZoneId') and is_active;
    if not found then
      return jsonb_build_object('status','FAILED','reason','DELIVERY_ZONE_NOT_FOUND',
        'reasonText','That delivery area is not available.');
    end if;
    if v_zone.is_configured then
      v_shipping := v_zone.shipping_fee;
      if v_zone.free_shipping_threshold is not null and v_subtotal >= v_zone.free_shipping_threshold then
        v_shipping := 0;
      end if;
    else
      v_quoted := false;
      v_shipping := 0;
    end if;
  else
    v_quoted := false;
  end if;

  select coalesce((value #>> '{}')::numeric, 72) into v_reservation_hours
    from public.system_settings where key = 'stock_reservation_hours';
  v_reservation_hours := coalesce(v_reservation_hours, 72);

  v_order_number := 'KMD-ORDER-' || lpad(nextval('public.kmd_order_seq')::text, 6, '0');

  insert into public.orders (
    order_number, buyer_profile_id, buyer_member_code, customer_type,
    guest_name, guest_phone, guest_email,
    delivery_zone_id, shipping_address, shipping_barangay, shipping_city,
    shipping_province, shipping_postal_code,
    subtotal, shipping_fee, total_amount, is_shipping_quoted,
    payment_method, status, fulfillment_status, customer_notes, is_test
  ) values (
    v_order_number,
    case when v_profile.id is null then null else v_profile.id end,
    case when v_profile.id is null then 'GUEST' else v_profile.member_code end,
    case when v_profile.id is null then 'guest' else 'member' end,
    v_guest_name, v_guest_phone, v_guest_email,
    case when v_zone.id is null then null else v_zone.id end,
    nullif(trim(coalesce(p_payload->>'shippingAddress','')), ''),
    nullif(trim(coalesce(p_payload->>'shippingBarangay','')), ''),
    nullif(trim(coalesce(p_payload->>'shippingCity','')), ''),
    nullif(trim(coalesce(p_payload->>'shippingProvince','')), ''),
    nullif(trim(coalesce(p_payload->>'shippingPostalCode','')), ''),
    v_subtotal, v_shipping, v_subtotal + v_shipping, v_quoted,
    v_payment_method, 'pending_payment', 'unfulfilled',
    nullif(trim(coalesce(p_payload->>'customerNotes','')), ''),
    coalesce(v_profile.is_test, false)
  ) returning id, access_token into v_order_id, v_token;

  -- ---- line items (priced from the catalogue, never from the request)
  for v_line in select * from jsonb_array_elements(v_items) loop
    v_qty := (v_line->>'quantity')::int;
    select * into v_product from public.products
      where upper(sku) = upper(trim(v_line->>'sku'));

    insert into public.order_items (order_id, product_id, sku, product_name, quantity, unit_price, line_total)
    values (v_order_id, v_product.id, v_product.sku, v_product.name, v_qty,
            v_product.selling_price, v_product.selling_price * v_qty);

    -- ---- reserve the stock inside the same transaction
    if v_product.track_inventory and not v_product.is_digital then
      insert into public.stock_reservations (product_id, order_id, quantity, status, expires_at)
      values (v_product.id, v_order_id, v_qty, 'held', now() + (v_reservation_hours || ' hours')::interval);

      select * into v_inv from public.inventory where product_id = v_product.id for update;
      if found and not v_inv.is_unlimited then
        update public.inventory
          set reserved_quantity = reserved_quantity + v_qty, updated_at = now()
          where product_id = v_product.id;

        insert into public.stock_movements (product_id, movement_type, delta, quantity_before, quantity_after, order_id, note)
        values (v_product.id, 'reservation', -v_qty, v_inv.quantity_on_hand,
                v_inv.quantity_on_hand, v_order_id, 'Reserved at checkout ' || v_order_number);
      end if;
    end if;
  end loop;

  insert into public.order_status_history (order_id, from_status, to_status, note, is_test)
  values (v_order_id, null, 'pending_payment', 'Order placed at checkout', coalesce(v_profile.is_test,false));

  perform public.kmd_audit(v_profile.id, 'ORDER_PLACED', v_profile.id, v_order_id,
    'orders', v_order_id::text, null,
    jsonb_build_object('orderNumber', v_order_number, 'total', v_subtotal + v_shipping,
                       'items', jsonb_array_length(v_items), 'customerType',
                       case when v_profile.id is null then 'guest' else 'member' end),
    'Order placed via the online store', coalesce(v_profile.is_test,false));

  -- ---- tell the administrators a new order needs payment verification
  insert into public.notifications (profile_id, type, title, body, link, metadata)
  select ur.user_id, 'order.created', 'New order ' || v_order_number,
         'A new order is awaiting payment verification.',
         '/admin/payment-verification',
         jsonb_build_object('orderNumber', v_order_number, 'orderId', v_order_id)
  from public.user_roles ur where ur.role in ('admin','super_admin')
  on conflict do nothing;

  return jsonb_build_object(
    'status','CREATED',
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'accessToken', v_token,
    'subtotal', v_subtotal,
    'shippingFee', v_shipping,
    'shippingQuoted', v_quoted,
    'totalAmount', v_subtotal + v_shipping,
    'customerType', case when v_profile.id is null then 'guest' else 'member' end,
    'reasonText','Order placed. It is awaiting payment verification.');
end $$;

-- ============================================================
-- 8. submit a payment proof (guest or member)
-- ============================================================
create or replace function public.kmd_checkout_submit_proof(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_method text := nullif(trim(coalesce(p_payload->>'method','')), '');
  v_proof_path text := nullif(trim(coalesce(p_payload->>'proofPath','')), '');
  v_contact text := lower(nullif(trim(coalesce(p_payload->>'contact','')), ''));
  v_token uuid := public.kmd_try_uuid(p_payload->>'accessToken');
  v_amount numeric(14,2);
begin
  if v_method is null or v_method not in ('gcash','maya','maya_bank','bank_transfer','cash','other') then
    return jsonb_build_object('status','FAILED','reason','VALIDATION','reasonText','Choose how you paid.');
  end if;
  if v_proof_path is null then
    return jsonb_build_object('status','FAILED','reason','PROOF_REQUIRED','reasonText','Attach your proof of payment.');
  end if;

  select * into v_order from public.orders
    where order_number = trim(coalesce(p_payload->>'orderNumber','')) for update;
  if not found then
    return jsonb_build_object('status','FAILED','reason','ORDER_NOT_FOUND','reasonText','We could not find that order number.');
  end if;

  -- authorise: the member who owns it, the matching guest contact, or the token
  if not (
    (v_uid is not null and v_order.buyer_profile_id = v_uid)
    or (v_token is not null and v_token = v_order.access_token)
    or (v_contact is not null and (v_contact = v_order.guest_email or v_contact = v_order.guest_phone))
  ) then
    return jsonb_build_object('status','FAILED','reason','NOT_AUTHORIZED',
      'reasonText','We could not match that order to your details.');
  end if;

  if v_order.status in ('cancelled','rejected') then
    return jsonb_build_object('status','FAILED','reason','ORDER_NOT_OPEN',
      'reasonText','This order is ' || v_order.status || ' and can no longer accept a payment.');
  end if;

  v_amount := coalesce(nullif(trim(coalesce(p_payload->>'amount','')), '')::numeric, v_order.total_amount);

  insert into public.payment_proofs (
    order_id, member_id, member_code, guest_email, guest_name, method,
    reference_number, bank_name, account_name, amount, proof_path, status, is_test
  ) values (
    v_order.id, v_order.buyer_profile_id, v_order.buyer_member_code,
    v_order.guest_email, v_order.guest_name, v_method,
    nullif(trim(coalesce(p_payload->>'referenceNumber','')), ''),
    nullif(trim(coalesce(p_payload->>'bankName','')), ''),
    nullif(trim(coalesce(p_payload->>'accountName','')), ''),
    v_amount, v_proof_path, 'under_review', v_order.is_test
  );

  update public.orders set status = 'proof_submitted' where id = v_order.id;
  insert into public.order_status_history (order_id, from_status, to_status, note, is_test)
  values (v_order.id, v_order.status, 'proof_submitted', 'Proof of payment uploaded', v_order.is_test);

  perform public.kmd_audit(v_uid, 'PAYMENT_PROOF_SUBMITTED', v_order.buyer_profile_id, v_order.id,
    'payment_proofs', v_order.id::text, null,
    jsonb_build_object('method', v_method, 'amount', v_amount),
    'Proof of payment uploaded for ' || v_order.order_number, v_order.is_test);

  insert into public.notifications (profile_id, type, title, body, link, metadata)
  select ur.user_id, 'payment.proof_submitted', 'Proof uploaded for ' || v_order.order_number,
         'A customer submitted proof of payment.',
         '/admin/payment-verification',
         jsonb_build_object('orderId', v_order.id, 'orderNumber', v_order.order_number)
  from public.user_roles ur where ur.role in ('admin','super_admin');

  return jsonb_build_object('status','SUBMITTED','orderNumber', v_order.order_number,
    'orderStatus','proof_submitted',
    'reasonText','Your proof of payment is in. We will verify it and update your order.');
end $$;

-- ============================================================
-- 9. order tracking (guest)
-- ============================================================
create or replace function public.kmd_checkout_track_order(p_order_number text, p_contact text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_contact text := lower(nullif(trim(coalesce(p_contact,'')), ''));
  v_items jsonb;
begin
  select * into v_order from public.orders where order_number = trim(coalesce(p_order_number,''));
  if not found then
    return jsonb_build_object('found', false,
      'reasonText','We could not find an order with those details.');
  end if;

  if not (
    (auth.uid() is not null and v_order.buyer_profile_id = auth.uid())
    or v_contact = v_order.guest_email
    or v_contact = v_order.guest_phone
    or public.kmd_try_uuid(p_contact) = v_order.access_token
  ) then
    return jsonb_build_object('found', false,
      'reasonText','We could not find an order with those details.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sku', oi.sku, 'name', oi.product_name, 'quantity', oi.quantity,
    'unitPrice', oi.unit_price, 'lineTotal', oi.line_total)), '[]'::jsonb)
  into v_items
  from public.order_items oi where oi.order_id = v_order.id;

  return jsonb_build_object(
    'found', true,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'fulfillmentStatus', v_order.fulfillment_status,
    'paymentMethod', v_order.payment_method,
    'subtotal', v_order.subtotal,
    'shippingFee', v_order.shipping_fee,
    'isShippingQuoted', v_order.is_shipping_quoted,
    'totalAmount', v_order.total_amount,
    'courier', v_order.courier,
    'trackingNumber', v_order.tracking_number,
    'customerName', v_order.guest_name,
    'createdAt', v_order.created_at,
    'items', v_items,
    'awaitingPaymentVerification', v_order.status in ('pending_payment','proof_submitted','under_review'));
end $$;
