-- KMD DIGITAL SOLUTIONS — ADDITION ONLY.
--
-- A self-contained module: the KMD Digital Solutions listing catalogue, the
-- client request form store and the quotation record.
--
-- It deliberately touches nothing that already exists. No product, membership
-- package, order, reward configuration, point ledger or loyalty ledger is
-- altered, and no existing record is recalculated. Because the offerings live in
-- their own table and never become order lines, a digital offering can never
-- generate a Unilevel point or a loyalty credit.

-- ---------------------------------------------------------------- offerings --
--
-- One row per published KMD Digital Solutions listing: the five Digital Products
-- & AI Learning Packages (A-E) and the Digital Services for Clients. Every
-- description, inclusion, price, recurring fee and maintenance alternative on
-- the public page is stored here and editable by an administrator, so no copy is
-- hard-coded in the interface.

create table if not exists public.digital_offerings (
  id uuid primary key default gen_random_uuid(),
  offering_key text not null unique,
  offering_group text not null,
  label text not null,
  name text not null,
  summary text,
  description text,
  inclusions jsonb not null default '[]'::jsonb,
  price numeric not null default 0,
  promo_price numeric,
  regular_price numeric,
  annual_fee numeric,
  -- The recurring charge is named exactly as the offering specifies: "Hosting",
  -- "Domain", "Hosting and domain combined" or "Optional hosting". Only the
  -- offering itself decides which of them applies, so both are never implied.
  annual_fee_label text,
  annual_fee_option text not null default 'none',
  maintenance_options jsonb not null default '[]'::jsonb,
  payment_terms_mode text not null default 'product_default',
  payment_terms_note text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_offerings_group_check check (offering_group in ('learning_package', 'service')),
  constraint digital_offerings_fee_option_check check (annual_fee_option in ('none', 'optional', 'recurring')),
  constraint digital_offerings_terms_check check (payment_terms_mode in ('product_default', 'project_50_50')),
  constraint digital_offerings_amount_check check (
    price >= 0
    and coalesce(promo_price, 0) >= 0
    and coalesce(regular_price, 0) >= 0
    and coalesce(annual_fee, 0) >= 0
  )
);

alter table public.digital_offerings enable row level security;

drop policy if exists digital_offerings_public_read on public.digital_offerings;
create policy digital_offerings_public_read on public.digital_offerings
  for select to anon, authenticated using (is_active);

-- Rows are readable by visitors while they are published, and are written only
-- through the audited administrator function below.
grant select on public.digital_offerings to anon, authenticated;

create index if not exists digital_offerings_listing_idx
  on public.digital_offerings (offering_group, sort_order);

-- ----------------------------------------------------------- client requests --
--
-- A request is a request. It is never a payment, never an order and never an
-- accepted contract: nothing in this table is read by the checkout, the reward
-- engine or the compensation ledgers.

create table if not exists public.client_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  request_type text not null default 'service',
  client_name text not null,
  phone text not null,
  email text not null,
  business_name text,
  client_address text,
  learning_goals text,
  products_services text,
  required_features text,
  preferred_domain text,
  design_references text,
  content_supplied text,
  attachment_paths jsonb not null default '[]'::jsonb,
  preferred_completion date,
  hosting_preference text,
  maintenance_preference text,
  maintenance_choice text,
  items jsonb not null default '[]'::jsonb,
  estimated_total numeric not null default 0,
  dedupe_key text not null,
  status text not null default 'submitted',
  admin_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_requests_status_check
    check (status in ('submitted', 'in_review', 'quoted', 'closed', 'cancelled')),
  constraint client_requests_type_check
    check (request_type in ('learning_package', 'service')),
  constraint client_requests_maintenance_choice_check
    check (maintenance_choice is null or maintenance_choice in ('co_partner_5_percent', 'client_monthly_50000'))
);

-- One live request per client, per set, per scope. Two identical submissions
-- cannot both exist: the second insert loses to this index. Closing or
-- cancelling a request releases the key, so a client may order the same set
-- again once the earlier request is finished.
create unique index if not exists client_requests_active_dedupe_idx
  on public.client_requests (dedupe_key)
  where status in ('submitted', 'in_review', 'quoted');

create index if not exists client_requests_queue_idx
  on public.client_requests (status, submitted_at desc);

alter table public.client_requests enable row level security;

-- Client information is confidential: only an administrator reads a request.
-- There is deliberately no insert or update policy — submissions arrive through
-- kmd_client_request_submit and changes through the audited administrator
-- function, so neither can be forged from the browser.
drop policy if exists client_requests_admin_read on public.client_requests;
create policy client_requests_admin_read on public.client_requests
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

grant select on public.client_requests to authenticated;

-- -------------------------------------------------------------- quotations --
--
-- The saved quotation is the single source of truth for every output: the
-- on-screen preview, the Word document, the PDF and the printed copy all render
-- this row and nothing else.

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique,
  request_id uuid references public.client_requests(id) on delete set null,
  quotation_date date not null default ((now() at time zone 'Asia/Manila')::date),
  valid_until date,
  target_completion date,
  client_name text not null,
  client_address text,
  contact_number text,
  email text,
  business_name text,
  items jsonb not null default '[]'::jsonb,
  additional_work jsonb not null default '[]'::jsonb,
  services_requested jsonb not null default '[]'::jsonb,
  project_requirements text,
  scope text,
  deliverables text,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  tax_amount numeric not null default 0,
  included_fees_total numeric not null default 0,
  total_contract_price numeric not null default 0,
  optional_fees jsonb not null default '[]'::jsonb,
  separate_fees_total numeric not null default 0,
  separate_annual_total numeric not null default 0,
  separate_monthly_total numeric not null default 0,
  maintenance_mode text not null default 'none',
  maintenance_note text,
  payment_terms_mode text not null default 'product_default',
  payment_terms_note text,
  deposit_amount numeric,
  balance_amount numeric,
  terms text,
  prepared_by text not null default 'Dan Taoc',
  status text not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotations_status_check
    check (status in ('draft', 'issued', 'accepted', 'void')),
  constraint quotations_terms_check
    check (payment_terms_mode in ('product_default', 'project_50_50')),
  constraint quotations_maintenance_check
    check (maintenance_mode in ('none', 'co_partner_5_percent', 'client_monthly_50000')),
  constraint quotations_amounts_check check (
    subtotal >= 0 and discount >= 0 and tax_amount >= 0
    and included_fees_total >= 0 and total_contract_price >= 0
  )
);

create index if not exists quotations_list_idx on public.quotations (quotation_date desc, quotation_number);

alter table public.quotations enable row level security;

drop policy if exists quotations_admin_read on public.quotations;
create policy quotations_admin_read on public.quotations
  for select to authenticated using (public.kmd_is_admin(auth.uid()));

grant select on public.quotations to authenticated;

-- ------------------------------------------------------------ numbering ----

create or replace function public.kmd_next_document_number(p_kind text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_year text := to_char(now() at time zone 'Asia/Manila', 'YYYY');
  v_seq integer;
begin
  -- Serialised per kind so two simultaneous submissions can never take the same
  -- number. The lock is released when the surrounding transaction ends.
  perform pg_advisory_xact_lock(hashtext('kmd-document-number-' || p_kind));

  if p_kind = 'request' then
    select coalesce(max(nullif(split_part(request_number, '-', 4), '')::integer), 0) + 1
      into v_seq
      from public.client_requests
     where request_number like 'KMD-REQ-' || v_year || '-%';
    return 'KMD-REQ-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  end if;

  if p_kind = 'quotation' then
    select coalesce(max(nullif(split_part(quotation_number, '-', 3), '')::integer), 0) + 1
      into v_seq
      from public.quotations
     where quotation_number like 'KMD-' || v_year || '-%';
    return 'KMD-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  end if;

  raise exception 'UNKNOWN_DOCUMENT_KIND: %', p_kind;
end $$;

revoke all on function public.kmd_next_document_number(text) from public, anon, authenticated;
grant execute on function public.kmd_next_document_number(text) to service_role;

-- ------------------------------------------------- public request submission --

-- The client request form posts here. Validation, the item snapshot that fixes
-- the agreed price at submission time, and the duplicate decision all happen in
-- one transaction on the server: a repeated submission is refused by the unique
-- index above, not by a disabled button.
create or replace function public.kmd_client_request_submit(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(p_payload ->> 'clientName', '')), '');
  v_phone text := nullif(btrim(coalesce(p_payload ->> 'phone', '')), '');
  v_email text := lower(nullif(btrim(coalesce(p_payload ->> 'email', '')), ''));
  v_keys text[];
  v_key text;
  v_offering public.digital_offerings%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_group text;
  v_scope text;
  v_dedupe text;
  v_number text;
  v_new_id uuid;
  v_existing public.client_requests%rowtype;
  v_date date;
begin
  if v_name is null then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Enter the client or authorized requester name.');
  end if;
  if v_phone is null or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7 then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Enter a contact number we can reach you on.');
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Enter a valid email address.');
  end if;

  select coalesce(array_agg(distinct upper(btrim(value))), '{}'::text[])
    into v_keys
    from jsonb_array_elements_text(coalesce(p_payload -> 'itemKeys', '[]'::jsonb)) as value
   where length(btrim(value)) > 0;

  if coalesce(array_length(v_keys, 1), 0) = 0 then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Select at least one package or service.');
  end if;

  foreach v_key in array v_keys loop
    select * into v_offering
      from public.digital_offerings
     where offering_key = v_key and is_active;

    if not found then
      return jsonb_build_object(
        'status', 'FAILED',
        'reasonText', format('The listing %s is not available. Refresh the page and choose again.', v_key)
      );
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'offeringKey', v_offering.offering_key,
      'label', v_offering.label,
      'name', v_offering.name,
      'group', v_offering.offering_group,
      'price', v_offering.price,
      'promoPrice', v_offering.promo_price,
      'regularPrice', v_offering.regular_price,
      'annualFee', v_offering.annual_fee,
      'annualFeeLabel', v_offering.annual_fee_label,
      'annualFeeOption', v_offering.annual_fee_option,
      'paymentTermsMode', v_offering.payment_terms_mode,
      'inclusions', v_offering.inclusions
    ));

    v_total := v_total + v_offering.price;
  end loop;

  -- A request that includes a website or dashboard is a project request; one
  -- made only of learning packages is not, which is what keeps the 50/50
  -- project terms away from ebooks and training.
  select case
           when exists (
             select 1 from jsonb_array_elements(v_items) as item
              where item ->> 'group' = 'service'
           ) then 'service'
           else 'learning_package'
         end
    into v_group;

  v_scope := coalesce(p_payload ->> 'requiredFeatures', '') || '|' || coalesce(p_payload ->> 'learningGoals', '');
  v_dedupe := md5(
    coalesce(v_email, '') || '|' ||
    regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g') || '|' ||
    array_to_string(v_keys, ',') || '|' ||
    md5(v_scope)
  );

  begin
    v_date := nullif(btrim(coalesce(p_payload ->> 'preferredCompletion', '')), '')::date;
  exception when others then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'The preferred completion date is not a valid date.');
  end;

  v_number := public.kmd_next_document_number('request');

  insert into public.client_requests (
    request_number, request_type, client_name, phone, email, business_name, client_address,
    learning_goals, products_services, required_features, preferred_domain, design_references,
    content_supplied, attachment_paths, preferred_completion, hosting_preference,
    maintenance_preference, maintenance_choice, items, estimated_total, dedupe_key
  ) values (
    v_number, v_group, v_name, v_phone, v_email,
    nullif(btrim(coalesce(p_payload ->> 'businessName', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'clientAddress', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'learningGoals', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'productsServices', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'requiredFeatures', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'preferredDomain', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'designReferences', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'contentSupplied', '')), ''),
    coalesce(p_payload -> 'attachmentPaths', '[]'::jsonb),
    v_date,
    nullif(btrim(coalesce(p_payload ->> 'hostingPreference', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'maintenancePreference', '')), ''),
    case
      when nullif(btrim(coalesce(p_payload ->> 'maintenanceChoice', '')), '') in
           ('co_partner_5_percent', 'client_monthly_50000')
        then btrim(p_payload ->> 'maintenanceChoice')
      else null
    end,
    v_items, v_total, v_dedupe
  )
  on conflict (dedupe_key) where status in ('submitted', 'in_review', 'quoted') do nothing
  returning id into v_new_id;

  if v_new_id is null then
    select * into v_existing
      from public.client_requests
     where dedupe_key = v_dedupe
       and status in ('submitted', 'in_review', 'quoted')
     order by submitted_at desc
     limit 1;

    return jsonb_build_object(
      'status', 'DUPLICATE',
      'duplicate', true,
      'requestNumber', v_existing.request_number,
      'submittedAt', v_existing.submitted_at,
      'reasonText', format(
        'This request was already received on %s as %s, so nothing new was created. Quote that reference in any message to us, or change the requirements and send it again.',
        to_char(v_existing.submitted_at at time zone 'Asia/Manila', 'FMDD Mon YYYY HH24:MI'),
        v_existing.request_number
      )
    );
  end if;

  return jsonb_build_object(
    'status', 'CREATED',
    'duplicate', false,
    'requestNumber', v_number,
    'requestType', v_group,
    'estimatedTotal', v_total,
    'items', v_items,
    'reasonText', 'Request received. This is a request for a quotation — no payment has been taken and no contract exists yet.'
  );
end $$;

revoke all on function public.kmd_client_request_submit(jsonb) from public;
grant execute on function public.kmd_client_request_submit(jsonb) to anon, authenticated;

-- ------------------------------------------------------- administrator side --

-- Creates or updates one listing. Used by the administrator screen that owns the
-- descriptions, inclusions, prices and recurring fees.
create or replace function public.kmd_admin_digital_offering_save(p_actor uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key text := upper(btrim(coalesce(p_payload ->> 'offeringKey', '')));
  v_group text := coalesce(nullif(btrim(coalesce(p_payload ->> 'offeringGroup', '')), ''), 'service');
  v_name text := nullif(btrim(coalesce(p_payload ->> 'name', '')), '');
  v_label text := nullif(btrim(coalesce(p_payload ->> 'label', '')), '');
  v_price numeric := coalesce(nullif(btrim(coalesce(p_payload ->> 'price', '')), '')::numeric, 0);
  v_fee numeric := nullif(btrim(coalesce(p_payload ->> 'annualFee', '')), '')::numeric;
  v_fee_option text := coalesce(nullif(btrim(coalesce(p_payload ->> 'annualFeeOption', '')), ''), 'none');
  v_terms text := coalesce(nullif(btrim(coalesce(p_payload ->> 'paymentTermsMode', '')), ''), 'product_default');
  v_previous public.digital_offerings%rowtype;
  v_id uuid;
begin
  if v_key = '' then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'A listing key is required.');
  end if;
  if v_name is null then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Enter the listing name.');
  end if;
  if v_group not in ('learning_package', 'service') then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'The listing group must be a learning package or a service.');
  end if;
  if v_price < 0 or coalesce(v_fee, 0) < 0 then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Prices and fees cannot be negative.');
  end if;
  if v_fee_option not in ('none', 'optional', 'recurring') then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'The recurring fee must be none, optional or recurring.');
  end if;
  if v_fee_option <> 'none'
     and (v_fee is null or nullif(btrim(coalesce(p_payload ->> 'annualFeeLabel', '')), '') is null) then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'A recurring fee needs both an amount and the label it is published under.');
  end if;

  select * into v_previous from public.digital_offerings where offering_key = v_key;

  insert into public.digital_offerings (
    offering_key, offering_group, label, name, summary, description, inclusions,
    price, promo_price, regular_price, annual_fee, annual_fee_label, annual_fee_option,
    maintenance_options, payment_terms_mode, payment_terms_note, sort_order, is_active, updated_at
  ) values (
    v_key, v_group, coalesce(v_label, v_key), v_name,
    nullif(btrim(coalesce(p_payload ->> 'summary', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'description', '')), ''),
    coalesce(p_payload -> 'inclusions', '[]'::jsonb),
    v_price,
    nullif(btrim(coalesce(p_payload ->> 'promoPrice', '')), '')::numeric,
    nullif(btrim(coalesce(p_payload ->> 'regularPrice', '')), '')::numeric,
    v_fee,
    nullif(btrim(coalesce(p_payload ->> 'annualFeeLabel', '')), ''),
    v_fee_option,
    coalesce(p_payload -> 'maintenanceOptions', '[]'::jsonb),
    v_terms,
    nullif(btrim(coalesce(p_payload ->> 'paymentTermsNote', '')), ''),
    coalesce(nullif(btrim(coalesce(p_payload ->> 'sortOrder', '')), '')::integer, v_previous.sort_order, 0),
    coalesce((p_payload ->> 'isActive')::boolean, true),
    now()
  )
  on conflict (offering_key) do update set
    offering_group = excluded.offering_group,
    label = excluded.label,
    name = excluded.name,
    summary = excluded.summary,
    description = excluded.description,
    inclusions = excluded.inclusions,
    price = excluded.price,
    promo_price = excluded.promo_price,
    regular_price = excluded.regular_price,
    annual_fee = excluded.annual_fee,
    annual_fee_label = excluded.annual_fee_label,
    annual_fee_option = excluded.annual_fee_option,
    maintenance_options = excluded.maintenance_options,
    payment_terms_mode = excluded.payment_terms_mode,
    payment_terms_note = excluded.payment_terms_note,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now()
  returning id into v_id;

  perform public.kmd_audit(
    p_actor := p_actor,
    p_action := 'DIGITAL_OFFERING_SAVE',
    p_entity := 'digital_offerings',
    p_entity_id := v_id::text,
    p_previous := case when v_previous.id is null then null else jsonb_build_object(
      'name', v_previous.name, 'price', v_previous.price, 'annualFee', v_previous.annual_fee,
      'annualFeeLabel', v_previous.annual_fee_label, 'isActive', v_previous.is_active) end,
    p_new := jsonb_build_object(
      'offeringKey', v_key, 'name', v_name, 'price', v_price, 'annualFee', v_fee,
      'annualFeeLabel', p_payload ->> 'annualFeeLabel', 'isActive', coalesce((p_payload ->> 'isActive')::boolean, true)),
    p_reason := 'Digital listing saved by administrator'
  );

  return jsonb_build_object(
    'status', 'SAVED',
    'offeringKey', v_key,
    'created', v_previous.id is null,
    'previousName', v_previous.name
  );
end $$;

revoke all on function public.kmd_admin_digital_offering_save(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.kmd_admin_digital_offering_save(uuid, jsonb) to service_role;

-- Moves a request through the administrator queue. Historic rows keep their
-- submitted details; only the status, the reviewer and the internal note move.
create or replace function public.kmd_admin_client_request_update(
  p_actor uuid,
  p_request_id uuid,
  p_status text,
  p_notes text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_previous public.client_requests%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
begin
  select * into v_previous from public.client_requests where id = p_request_id;
  if v_previous.id is null then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'That request no longer exists.');
  end if;
  if v_status is not null and v_status not in ('submitted', 'in_review', 'quoted', 'closed', 'cancelled') then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Unknown request status.');
  end if;

  update public.client_requests
     set status = coalesce(v_status, status),
         admin_notes = coalesce(nullif(btrim(coalesce(p_notes, '')), ''), admin_notes),
         reviewed_by = case when coalesce(v_status, status) = 'submitted' then reviewed_by else p_actor end,
         reviewed_at = case when coalesce(v_status, status) = 'submitted' then reviewed_at else now() end,
         updated_at = now()
   where id = p_request_id;

  perform public.kmd_audit(
    p_actor := p_actor,
    p_action := 'CLIENT_REQUEST_UPDATE',
    p_entity := 'client_requests',
    p_entity_id := p_request_id::text,
    p_previous := jsonb_build_object('status', v_previous.status),
    p_new := jsonb_build_object('status', coalesce(v_status, v_previous.status)),
    p_reason := coalesce(nullif(btrim(coalesce(p_notes, '')), ''), 'Request updated by administrator')
  );

  return jsonb_build_object('status', 'UPDATED', 'requestNumber', v_previous.request_number);
end $$;

revoke all on function public.kmd_admin_client_request_update(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.kmd_admin_client_request_update(uuid, uuid, text, text) to service_role;

-- Saves a quotation and recomputes every figure from the line items.
--
-- The totals are calculated here and never accepted from the browser, so the
-- printed document, the Word file and the preview cannot disagree with the saved
-- record. A recurring charge is counted exactly once: it is either folded into
-- the total contract price as an included fee, or shown as billed separately —
-- never both — and at most one row of each kind is allowed.
create or replace function public.kmd_admin_quotation_save(p_actor uuid, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(btrim(coalesce(p_payload ->> 'quotationId', '')), '')::uuid;
  v_previous public.quotations%rowtype;
  v_request public.client_requests%rowtype;
  v_request_id uuid := nullif(btrim(coalesce(p_payload ->> 'requestId', '')), '')::uuid;
  v_items jsonb;
  v_additional jsonb;
  v_fees jsonb;
  v_fee jsonb;
  v_kinds text[] := '{}'::text[];
  v_kind text;
  v_subtotal numeric := 0;
  v_included numeric := 0;
  v_separate numeric := 0;
  v_annual numeric := 0;
  v_monthly numeric := 0;
  v_discount numeric := coalesce(nullif(btrim(coalesce(p_payload ->> 'discount', '')), '')::numeric, 0);
  v_tax numeric := coalesce(nullif(btrim(coalesce(p_payload ->> 'taxAmount', '')), '')::numeric, 0);
  v_total numeric := 0;
  v_mode text := coalesce(nullif(btrim(coalesce(p_payload ->> 'paymentTermsMode', '')), ''), 'product_default');
  v_maintenance text := coalesce(nullif(btrim(coalesce(p_payload ->> 'maintenanceMode', '')), ''), 'none');
  v_maintenance_note text := nullif(btrim(coalesce(p_payload ->> 'maintenanceNote', '')), '');
  v_status text := coalesce(nullif(btrim(coalesce(p_payload ->> 'status', '')), ''), 'draft');
  v_number text;
  v_number_created boolean := false;
  v_deposit numeric;
  v_balance numeric;
  v_row public.quotations%rowtype;
begin
  if v_status not in ('draft', 'issued', 'accepted', 'void') then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Unknown quotation status.');
  end if;
  if v_mode not in ('product_default', 'project_50_50') then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Unknown payment terms.');
  end if;
  if v_maintenance not in ('none', 'co_partner_5_percent', 'client_monthly_50000') then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Choose one maintenance arrangement, or none.');
  end if;

  v_items := coalesce(p_payload -> 'items', '[]'::jsonb);
  v_additional := coalesce(p_payload -> 'additionalWork', '[]'::jsonb);
  v_fees := coalesce(p_payload -> 'optionalFees', '[]'::jsonb);

  select coalesce(sum(coalesce(nullif(item ->> 'amount', '')::numeric, 0)), 0)
    into v_subtotal
    from jsonb_array_elements(v_items || v_additional) as item;

  if v_subtotal < 0 or v_discount < 0 or v_tax < 0 then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'Amounts cannot be negative.');
  end if;
  if v_discount > v_subtotal + v_tax then
    return jsonb_build_object('status', 'FAILED', 'reasonText', 'The discount cannot be larger than the quoted work.');
  end if;

  for v_fee in select * from jsonb_array_elements(v_fees) loop
    v_kind := coalesce(nullif(btrim(coalesce(v_fee ->> 'kind', '')), ''), 'other');
    if v_kind not in ('maintenance', 'domain', 'hosting', 'other') then
      return jsonb_build_object('status', 'FAILED', 'reasonText', format('Unknown recurring charge kind: %s', v_kind));
    end if;
    -- A percentage arrangement is never a fixed amount, and it can never be
    -- folded into the total: it is always shown separately until it is applied.
    if coalesce(nullif(btrim(coalesce(v_fee ->> 'percent', '')), '')::numeric, 0) > 0 then
      v_separate := v_separate + 0;
    elsif coalesce((v_fee ->> 'includedInTotal')::boolean, false) then
      if v_kind <> 'other' and v_kind = any (v_kinds) then
        return jsonb_build_object('status', 'FAILED', 'reasonText', format('An included %s charge is already on this quotation.', v_kind));
      end if;
      v_kinds := array_append(v_kinds, v_kind);
      v_included := v_included + coalesce(nullif(btrim(coalesce(v_fee ->> 'amount', '')), '')::numeric, 0);
    else
      v_separate := v_separate + coalesce(nullif(btrim(coalesce(v_fee ->> 'amount', '')), '')::numeric, 0);
      if lower(coalesce(v_fee ->> 'per', '')) in ('year', 'annual', 'annually') then
        v_annual := v_annual + coalesce(nullif(btrim(coalesce(v_fee ->> 'amount', '')), '')::numeric, 0);
      elsif lower(coalesce(v_fee ->> 'per', '')) in ('month', 'monthly') then
        v_monthly := v_monthly + coalesce(nullif(btrim(coalesce(v_fee ->> 'amount', '')), '')::numeric, 0);
      end if;
    end if;
  end loop;

  v_total := greatest(v_subtotal + v_included - v_discount + v_tax, 0);

  if v_mode = 'project_50_50' then
    v_deposit := round(v_total / 2, 2);
    v_balance := v_total - v_deposit;
  else
    v_deposit := null;
    v_balance := null;
  end if;

  if v_maintenance = 'co_partner_5_percent' and v_maintenance_note is null and v_status in ('issued', 'accepted') then
    return jsonb_build_object(
      'status', 'FAILED',
      'reasonText', 'Record the agreed basis and the qualifying entry-pack encoding rules before issuing a quotation that applies the 5% co-partner arrangement.'
    );
  end if;

  if v_request_id is not null then
    select * into v_request from public.client_requests where id = v_request_id;
    if v_request.id is null then v_request_id := null; end if;
  end if;

  if v_id is null then
    v_number := public.kmd_next_document_number('quotation');
    v_number_created := true;

    insert into public.quotations (
      quotation_number, request_id, quotation_date, valid_until, target_completion,
      client_name, client_address, contact_number, email, business_name,
      items, additional_work, services_requested, project_requirements, scope, deliverables,
      subtotal, discount, tax_amount, included_fees_total, total_contract_price, optional_fees,
      separate_fees_total, separate_annual_total, separate_monthly_total,
      maintenance_mode, maintenance_note, payment_terms_mode, payment_terms_note,
      deposit_amount, balance_amount, terms, prepared_by, status, created_by, updated_at
    ) values (
      v_number, v_request_id,
      coalesce(nullif(btrim(coalesce(p_payload ->> 'quotationDate', '')), '')::date, (now() at time zone 'Asia/Manila')::date),
      nullif(btrim(coalesce(p_payload ->> 'validUntil', '')), '')::date,
      nullif(btrim(coalesce(p_payload ->> 'targetCompletion', '')), '')::date,
      coalesce(nullif(btrim(coalesce(p_payload ->> 'clientName', '')), ''), v_request.client_name, 'Client to be confirmed'),
      nullif(btrim(coalesce(p_payload ->> 'clientAddress', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'contactNumber', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'email', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'businessName', '')), ''),
      v_items, v_additional, coalesce(p_payload -> 'servicesRequested', '[]'::jsonb),
      nullif(btrim(coalesce(p_payload ->> 'projectRequirements', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'scope', '')), ''),
      nullif(btrim(coalesce(p_payload ->> 'deliverables', '')), ''),
      v_subtotal, v_discount, v_tax, v_included, v_total, v_fees,
      v_separate, v_annual, v_monthly,
      v_maintenance, v_maintenance_note, v_mode,
      nullif(btrim(coalesce(p_payload ->> 'paymentTermsNote', '')), ''),
      v_deposit, v_balance,
      nullif(btrim(coalesce(p_payload ->> 'terms', '')), ''),
      coalesce(nullif(btrim(coalesce(p_payload ->> 'preparedBy', '')), ''), 'Dan Taoc'),
      v_status, p_actor, now()
    )
    returning * into v_row;
  else
    select * into v_previous from public.quotations where id = v_id;
    if v_previous.id is null then
      return jsonb_build_object('status', 'FAILED', 'reasonText', 'That quotation no longer exists.');
    end if;

    update public.quotations
       set request_id = v_request_id,
           quotation_date = coalesce(nullif(btrim(coalesce(p_payload ->> 'quotationDate', '')), '')::date, quotation_date),
           valid_until = nullif(btrim(coalesce(p_payload ->> 'validUntil', '')), '')::date,
           target_completion = nullif(btrim(coalesce(p_payload ->> 'targetCompletion', '')), '')::date,
           client_name = coalesce(nullif(btrim(coalesce(p_payload ->> 'clientName', '')), ''), client_name),
           client_address = nullif(btrim(coalesce(p_payload ->> 'clientAddress', '')), ''),
           contact_number = nullif(btrim(coalesce(p_payload ->> 'contactNumber', '')), ''),
           email = nullif(btrim(coalesce(p_payload ->> 'email', '')), ''),
           business_name = nullif(btrim(coalesce(p_payload ->> 'businessName', '')), ''),
           items = v_items,
           additional_work = v_additional,
           services_requested = coalesce(p_payload -> 'servicesRequested', services_requested),
           project_requirements = nullif(btrim(coalesce(p_payload ->> 'projectRequirements', '')), ''),
           scope = nullif(btrim(coalesce(p_payload ->> 'scope', '')), ''),
           deliverables = nullif(btrim(coalesce(p_payload ->> 'deliverables', '')), ''),
           subtotal = v_subtotal,
           discount = v_discount,
           tax_amount = v_tax,
           included_fees_total = v_included,
           total_contract_price = v_total,
           optional_fees = v_fees,
           separate_fees_total = v_separate,
           separate_annual_total = v_annual,
           separate_monthly_total = v_monthly,
           maintenance_mode = v_maintenance,
           maintenance_note = v_maintenance_note,
           payment_terms_mode = v_mode,
           payment_terms_note = nullif(btrim(coalesce(p_payload ->> 'paymentTermsNote', '')), ''),
           deposit_amount = v_deposit,
           balance_amount = v_balance,
           terms = nullif(btrim(coalesce(p_payload ->> 'terms', '')), ''),
           prepared_by = coalesce(nullif(btrim(coalesce(p_payload ->> 'preparedBy', '')), ''), prepared_by),
           status = v_status,
           updated_at = now()
     where id = v_id
    returning * into v_row;
  end if;

  perform public.kmd_audit(
    p_actor := p_actor,
    p_action := case when v_number_created then 'QUOTATION_CREATE' else 'QUOTATION_SAVE' end,
    p_entity := 'quotations',
    p_entity_id := v_row.id::text,
    p_previous := case when v_previous.id is null then null else jsonb_build_object(
      'total', v_previous.total_contract_price, 'status', v_previous.status) end,
    p_new := jsonb_build_object(
      'quotationNumber', v_row.quotation_number,
      'total', v_row.total_contract_price,
      'separateFees', v_row.separate_fees_total,
      'status', v_row.status),
    p_reason := 'Quotation saved by administrator'
  );

  return jsonb_build_object(
    'status', 'SAVED',
    'created', v_number_created,
    'quotation', to_jsonb(v_row)
  );
end $$;

revoke all on function public.kmd_admin_quotation_save(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.kmd_admin_quotation_save(uuid, jsonb) to service_role;

-- --------------------------------------------------------------- storage ----
--
-- Client supplied content and logos go into a private bucket. Nobody but an
-- administrator can read it back; the request form may only upload into it.

insert into storage.buckets (id, name, public) values
  ('client-request-files', 'client-request-files', false)
on conflict (id) do nothing;

drop policy if exists kmd_client_request_files_insert on storage.objects;
create policy kmd_client_request_files_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'client-request-files');

drop policy if exists kmd_client_request_files_read on storage.objects;
create policy kmd_client_request_files_read on storage.objects
  for select to authenticated using (bucket_id = 'client-request-files' and public.kmd_is_admin(auth.uid()));

-- ------------------------------------------------------------ live refresh --

do $$
begin
  begin
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_requests'
    ) then
      execute 'alter publication supabase_realtime add table public.client_requests';
    end if;
  exception when others then
    raise notice 'client_requests realtime not enabled: %', sqlerrm;
  end;

  begin
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quotations'
    ) then
      execute 'alter publication supabase_realtime add table public.quotations';
    end if;
  exception when others then
    raise notice 'quotations realtime not enabled: %', sqlerrm;
  end;
end $$;

-- -------------------------------------------------------------- seed data ---
--
-- The published KMD Digital Solutions listings, exactly as supplied. Descriptions,
-- inclusions and prices remain editable afterwards from the administrator screen.

insert into public.digital_offerings (
  offering_key, offering_group, label, name, summary, inclusions,
  price, promo_price, regular_price, annual_fee, annual_fee_label, annual_fee_option,
  maintenance_options, payment_terms_mode, sort_order, is_active
) values
  ('LEARN-A', 'learning_package', 'Package A', 'Digital AI Level 1',
   'AI prompting, AI creatives, and simple landing page creation',
   '["AI prompting", "AI creatives", "Simple landing page creation"]'::jsonb,
   998, 998, null, null, null, 'none', '[]'::jsonb, 'product_default', 1, true),

  ('LEARN-B', 'learning_package', 'Package B', 'Create Landing Pages Without Coding',
   'Ebook',
   '["Ebook"]'::jsonb,
   3800, null, null, null, null, 'none', '[]'::jsonb, 'product_default', 2, true),

  ('LEARN-C', 'learning_package', 'Package C', 'Create Landing Pages and Maximize ChatGPT and Manus',
   'Live session, certificate, and ebook',
   '["Live session", "Certificate", "Ebook"]'::jsonb,
   7800, null, null, null, null, 'none', '[]'::jsonb, 'product_default', 3, true),

  ('LEARN-D', 'learning_package', 'Package D', 'Build an E-commerce Website with Chatbot Automation',
   'Live session, certificate, and ebook',
   '["Live session", "Certificate", "Ebook"]'::jsonb,
   24990, null, null, null, null, 'none', '[]'::jsonb, 'product_default', 4, true),

  ('LEARN-E', 'learning_package', 'Package E', 'Build MLM Systems and Business Operations Dashboards',
   'Live session, certificate, ebook, and hosting; practical training aimed at producing a running system',
   '["Live session", "Certificate", "Ebook", "Hosting", "Practical training aimed at producing a running system"]'::jsonb,
   99000, 99000, 150000, null, null, 'none', '[]'::jsonb, 'product_default', 5, true),

  ('SVC-LANDING', 'service', 'Service 1', 'Landing page', null,
   '["Landing page design and build"]'::jsonb,
   1980, null, null, 1500, 'Optional hosting', 'optional', '[]'::jsonb, 'project_50_50', 1, true),

  ('SVC-ECOM-1-2', 'service', 'Service 2', 'E-commerce ready website with 1-2 products and payment options', null,
   '["E-commerce ready website", "1-2 products", "Payment options"]'::jsonb,
   5000, null, null, 1500, 'Hosting', 'recurring', '[]'::jsonb, 'project_50_50', 2, true),

  ('SVC-ECOM-5', 'service', 'Service 3', 'E-commerce website with up to 5 products', null,
   '["E-commerce website", "Up to 5 products"]'::jsonb,
   7500, null, null, 1500, 'Hosting', 'recurring', '[]'::jsonb, 'project_50_50', 3, true),

  ('SVC-ECOM-10', 'service', 'Service 4', 'E-commerce website with 6-10 products', null,
   '["E-commerce website", "6-10 products"]'::jsonb,
   10000, null, null, 1500, 'Domain', 'recurring', '[]'::jsonb, 'project_50_50', 4, true),

  ('SVC-DASHBOARD', 'service', 'Service 5', 'Business operations or office dashboard', null,
   '["Business operations dashboard", "Office dashboard"]'::jsonb,
   25000, null, null, 1500, 'Domain', 'recurring', '[]'::jsonb, 'project_50_50', 5, true),

  ('SVC-MLM-DASHBOARD', 'service', 'Service 6', 'MLM or direct-selling dashboard', null,
   '["MLM dashboard", "Direct-selling dashboard"]'::jsonb,
   250000, 250000, 500000, 3000, 'Hosting and domain combined', 'recurring',
   '[{"key": "co_partner_5_percent", "label": "Co-partner arrangement", "detail": "5% of the entry-pack amount for every qualifying entry-pack encoding."},
     {"key": "client_monthly_50000", "label": "Client maintenance", "detail": "PHP 50,000 per month, billed to the client."}]'::jsonb,
   'project_50_50', 6, true)
on conflict (offering_key) do nothing;

-- Verification: what the public page will now publish.
select offering_group, offering_key, label, name, price, promo_price, regular_price,
       annual_fee, annual_fee_label, annual_fee_option, payment_terms_mode, is_active
  from public.digital_offerings
 order by offering_group, sort_order;
