-- ============================================================
-- ALL WHITE POOL PARTY / ZIMJA FEST
-- COMPLETE INITIAL DATABASE SCHEMA
--
-- Currency: NGN. Monetary values are integer kobo.
-- Database: Supabase PostgreSQL.
-- Apply only to a fresh database.
--
-- TICKET RULES:
-- 1. No tickets are generated at reservation.
-- 2. Payment must be confirmed by an authorized admin.
-- 3. One unique textual code is generated per admission.
-- 4. Payment approval and ticket creation are atomic.
-- 5. Each ticket can be checked in only once.
-- 6. QR credentials are optional; textual codes are official.
-- 7. Unpaid reservations expire after 20 minutes.
-- 8. Submitted payments have a 24-hour review window.
-- 9. Expiration processing marks both the order and its
--    unresolved payment submission as expired.
-- ============================================================


-- ============================================================
-- 01. ADMIN ROLES
-- ============================================================

do $$
begin
  create type public.admin_role as enum (
    'owner',
    'finance',
    'ticket_manager',
    'gate_staff',
    'support'
  );
exception
  when duplicate_object then null;
end;
$$;


-- ============================================================
-- 02. EVENTS
-- ============================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  event_start_at timestamptz not null,
  venue text not null default 'Undisclosed',
  created_at timestamptz not null default now()
);


-- ============================================================
-- 03. TICKET TYPES
-- ============================================================

create table public.ticket_types (
  id text primary key,
  event_id uuid not null references public.events(id),
  name text not null,
  price_amount_kobo bigint not null check (price_amount_kobo >= 0),
  admissions_per_unit integer not null check (admissions_per_unit > 0),
  early_bird_limit integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  currency text not null default 'NGN' check (currency = 'NGN'),
  created_at timestamptz not null default now()
);


-- ============================================================
-- 04. ORDERS
-- ============================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique,
  checkout_token_hash text not null,
  event_id uuid not null references public.events(id),
  ticket_type_id text not null references public.ticket_types(id),
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text not null,
  quantity integer not null check (quantity between 1 and 5),
  admissions_count integer not null check (admissions_count > 0),
  unit_price_kobo bigint not null,
  total_amount_kobo bigint not null,
  status text not null default 'reserved'
    check (status in (
      'reserved',
      'payment_submitted',
      'paid',
      'expired',
      'cancelled'
    )),
  reservation_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_ticket_status_idx
  on public.orders(ticket_type_id, status);

create index orders_reservation_expiry_idx
  on public.orders(status, reservation_expires_at);

create index orders_buyer_email_idx
  on public.orders(buyer_email);


-- ============================================================
-- 05. ATTENDEES
-- ============================================================

create table public.attendees (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  attendee_number integer not null,
  full_name text not null,
  created_at timestamptz not null default now(),
  unique (order_id, attendee_number)
);


-- ============================================================
-- 06. ADMIN USERS
-- ============================================================

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.admin_role not null default 'support',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 07. PAYMENT SUBMISSIONS
-- ============================================================

create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    constraint payment_submissions_order_id_fkey
    references public.orders(id),
  payment_reference text not null unique,
  sender_name text not null,
  sender_bank text,
  transfer_reference text not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  receipt_path text not null,
  status text not null default 'submitted'
    check (status in (
      'submitted',
      'under_review',
      'confirmed',
      'rejected',
      'expired'
    )),
  verified_amount_kobo bigint,
  bank_transaction_reference text,
  reviewed_by uuid references public.admin_users(user_id),
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index payment_submissions_status_idx
  on public.payment_submissions(status, created_at);

-- Only one active/unresolved or confirmed submission per order.
-- Expired and rejected submissions no longer block a new submission.
create unique index payment_one_unresolved_per_order
  on public.payment_submissions(order_id)
  where status in ('submitted', 'under_review', 'confirmed');

-- Prevent reuse of a verified bank transaction reference.
create unique index payment_verified_bank_reference_unique
  on public.payment_submissions(bank_transaction_reference)
  where status = 'confirmed'
    and bank_transaction_reference is not null;


-- ============================================================
-- 08. TICKETS
-- ============================================================

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  -- Official credential used for manual gate verification.
  ticket_code text not null unique,
  -- Optional QR credential component.
  qr_nonce text not null,
  event_id uuid not null references public.events(id),
  order_id uuid not null references public.orders(id),
  attendee_id uuid not null unique references public.attendees(id),
  ticket_type_id text not null references public.ticket_types(id),
  status text not null default 'active'
    check (status in ('active', 'used', 'cancelled')),
  issued_at timestamptz not null default now(),
  checked_in_at timestamptz,
  constraint ticket_code_format
    check (ticket_code ~ '^AWN-2026-[A-F0-9]{16}$')
);

create index tickets_order_idx on public.tickets(order_id);
create index tickets_event_status_idx on public.tickets(event_id, status);


-- ============================================================
-- 09. CHECK-INS
-- ============================================================

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets(id),
  checked_by uuid not null references public.admin_users(user_id),
  verification_method text not null
    check (verification_method in ('qr', 'manual')),
  checked_in_at timestamptz not null default now()
);


-- ============================================================
-- 10. ADMIN AUDIT LOGS
-- ============================================================

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(user_id),
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 11. AUTOMATIC EXPIRATION
-- ============================================================

-- Call this function from reservation, availability and dashboard
-- operations. It expires both the order and any unresolved payment
-- submission after the relevant deadline.
--
-- An expired payment is kept for history but is no longer included
-- in the pending-payment queue or the unique active-submission index.

create or replace function public.expire_pending_orders(
  p_now timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired_payments integer := 0;
  v_expired_orders integer := 0;
begin
  if p_now is null then
    raise exception 'INVALID_EXPIRATION_TIME';
  end if;

  -- Payment rows are updated first to follow the same lock order
  -- used by admin_review_payment (payment, then order).
  update public.payment_submissions p
  set
    status = 'expired',
    reviewed_at = p_now,
    admin_note = coalesce(
      nullif(trim(p.admin_note), ''),
      'Payment review window expired automatically.'
    )
  from public.orders o
  where
    o.id = p.order_id
    and o.status = 'payment_submitted'
    and o.reservation_expires_at <= p_now
    and p.status in ('submitted', 'under_review');

  get diagnostics v_expired_payments = row_count;

  -- This also expires abandoned reservations that never submitted
  -- a bank transfer (20-minute reservation deadline).
  update public.orders
  set
    status = 'expired',
    updated_at = p_now
  where
    status in ('reserved', 'payment_submitted')
    and reservation_expires_at <= p_now;

  get diagnostics v_expired_orders = row_count;

  return jsonb_build_object(
    'expiredOrders', v_expired_orders,
    'expiredPayments', v_expired_payments
  );
end;
$$;

revoke all on function public.expire_pending_orders(timestamptz)
  from public, anon, authenticated;
grant execute on function public.expire_pending_orders(timestamptz)
  to service_role;


-- ============================================================
-- 12. TICKET CREDENTIAL GENERATION
-- ============================================================

-- Tickets can only be inserted for a paid order with a confirmed
-- payment. The trigger generates the official unique text code
-- and the optional QR nonce during admin payment approval.

create or replace function public.assign_ticket_credentials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_candidate text;
begin
  select *
  into v_order
  from public.orders
  where id = new.order_id;

  if not found then
    raise exception 'TICKET_ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'paid' then
    raise exception 'TICKET_PAYMENT_NOT_CONFIRMED';
  end if;

  if not exists (
    select 1
    from public.payment_submissions p
    where
      p.order_id = v_order.id
      and p.status = 'confirmed'
      and p.verified_amount_kobo = v_order.total_amount_kobo
      and nullif(trim(coalesce(p.bank_transaction_reference, '')), '') is not null
  ) then
    raise exception 'TICKET_PAYMENT_NOT_CONFIRMED';
  end if;

  if new.event_id <> v_order.event_id
     or new.ticket_type_id <> v_order.ticket_type_id then
    raise exception 'TICKET_ORDER_DETAILS_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.attendees a
    where a.id = new.attendee_id
      and a.order_id = new.order_id
  ) then
    raise exception 'TICKET_ATTENDEE_MISMATCH';
  end if;

  loop
    v_candidate :=
      'AWN-2026-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

    exit when not exists (
      select 1 from public.tickets where ticket_code = v_candidate
    );
  end loop;

  new.ticket_code := v_candidate;
  new.qr_nonce := replace(gen_random_uuid()::text, '-', '');
  new.status := 'active';
  new.checked_in_at := null;

  return new;
end;
$$;

create trigger tickets_assign_credentials
before insert on public.tickets
for each row
execute function public.assign_ticket_credentials();


-- ============================================================
-- 13. INITIAL EVENT CONFIGURATION
-- ============================================================

insert into public.events (slug, name, event_start_at, venue)
values (
  'all-white-pool-party',
  'ALL WHITE POOL PARTY',
  '2026-12-13 20:00:00+01',
  'Undisclosed'
)
on conflict (slug) do update set
  name = excluded.name,
  event_start_at = excluded.event_start_at;


-- ============================================================
-- 14. INITIAL TICKET CONFIGURATION
-- ============================================================

-- Early Bird: 30 individual admissions, ₦4,000 each.
insert into public.ticket_types (
  id, event_id, name, price_amount_kobo,
  admissions_per_unit, early_bird_limit, sort_order
)
select
  'early-bird', id, 'Early Bird', 400000, 1, 30, 1
from public.events
where slug = 'all-white-pool-party'
on conflict (id) do update set
  event_id = excluded.event_id,
  name = excluded.name,
  price_amount_kobo = excluded.price_amount_kobo,
  admissions_per_unit = excluded.admissions_per_unit,
  early_bird_limit = excluded.early_bird_limit;

-- Regular: ₦8,000 per individual admission.
insert into public.ticket_types (
  id, event_id, name, price_amount_kobo,
  admissions_per_unit, sort_order
)
select
  'regular', id, 'Regular', 800000, 1, 2
from public.events
where slug = 'all-white-pool-party'
on conflict (id) do update set
  event_id = excluded.event_id,
  name = excluded.name,
  price_amount_kobo = excluded.price_amount_kobo,
  admissions_per_unit = excluded.admissions_per_unit;

-- Friends of 5: ₦36,000 for five admissions.
insert into public.ticket_types (
  id, event_id, name, price_amount_kobo,
  admissions_per_unit, sort_order
)
select
  'friends-of-five', id, 'Friends of 5', 3600000, 5, 3
from public.events
where slug = 'all-white-pool-party'
on conflict (id) do update set
  event_id = excluded.event_id,
  name = excluded.name,
  price_amount_kobo = excluded.price_amount_kobo,
  admissions_per_unit = excluded.admissions_per_unit;


-- ============================================================
-- 15. ROW LEVEL SECURITY
-- ============================================================

-- Browser clients have no direct table access. Server routes use
-- the Supabase service-role client after authentication/validation.

alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;
alter table public.attendees enable row level security;
alter table public.admin_users enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.tickets enable row level security;
alter table public.check_ins enable row level security;
alter table public.admin_audit_logs enable row level security;


-- ============================================================
-- 16. ATOMIC TICKET ORDER RESERVATION
-- ============================================================

create or replace function public.create_ticket_order(
  p_ticket_type_id text,
  p_quantity integer,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_attendees jsonb,
  p_checkout_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.ticket_types%rowtype;
  v_early public.ticket_types%rowtype;
  v_paid bigint := 0;
  v_held bigint := 0;
  v_limit integer;
  v_admissions integer;
  v_ref text;
  v_order uuid;
  v_expiry timestamptz;
  v_now timestamptz;
  v_guest record;
  v_full_name text;
  v_idx integer := 0;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 5 then
    raise exception 'INVALID_ORDER';
  end if;

  if length(trim(coalesce(p_buyer_name, ''))) not between 2 and 120
     or length(trim(coalesce(p_buyer_email, ''))) not between 5 and 254
     or position('@' in trim(coalesce(p_buyer_email, ''))) <= 1
     or length(trim(coalesce(p_buyer_phone, ''))) not between 7 and 24 then
    raise exception 'INVALID_BUYER_DETAILS';
  end if;

  if coalesce(p_checkout_token_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_CHECKOUT_TOKEN';
  end if;

  if p_attendees is null or jsonb_typeof(p_attendees) <> 'array' then
    raise exception 'INVALID_ATTENDEE_COUNT';
  end if;

  -- Every reservation takes this lock first, keeping the Early Bird
  -- inventory calculation serialized across ticket categories.
  select * into v_early
  from public.ticket_types
  where id = 'early-bird'
  for update;

  if not found or v_early.early_bird_limit is null
     or v_early.early_bird_limit < 1 then
    raise exception 'TICKET_CONFIGURATION_ERROR';
  end if;

  select * into v_ticket
  from public.ticket_types
  where id = p_ticket_type_id and is_active = true
  for update;

  if not found then
    raise exception 'TICKET_TYPE_NOT_FOUND';
  end if;

  if v_ticket.event_id <> v_early.event_id then
    raise exception 'TICKET_CONFIGURATION_ERROR';
  end if;

  v_admissions := p_quantity * v_ticket.admissions_per_unit;

  if jsonb_array_length(p_attendees) <> v_admissions then
    raise exception 'INVALID_ATTENDEE_COUNT';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_attendees) as guest(value)
    where
      coalesce(jsonb_typeof(guest.value -> 'fullName'), '') <> 'string'
      or length(trim(coalesce(guest.value ->> 'fullName', ''))) not between 2 and 100
  ) then
    raise exception 'INVALID_ATTENDEE_NAME';
  end if;

  -- Expire old reservations/payment submissions before counting stock.
  v_now := clock_timestamp();
  perform public.expire_pending_orders(v_now);

  select
    coalesce(sum(o.admissions_count) filter (where o.status = 'paid'), 0),
    coalesce(sum(o.admissions_count) filter (
      where o.status in ('reserved', 'payment_submitted')
        and o.reservation_expires_at > v_now
    ), 0)
  into v_paid, v_held
  from public.orders o
  where o.ticket_type_id = 'early-bird';

  v_limit := v_early.early_bird_limit;

  if p_ticket_type_id = 'early-bird' then
    if v_paid + v_held + v_admissions > v_limit then
      raise exception 'EARLY_BIRD_SOLD_OUT';
    end if;
  else
    -- Later ticket categories unlock only after all 30 Early Bird
    -- admissions have actually been paid for.
    if v_paid < v_limit then
      raise exception 'EARLY_BIRD_NOT_SOLD_OUT';
    end if;
  end if;

  v_ref :=
    'AWN-2026-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

  v_expiry := v_now + interval '20 minutes';

  insert into public.orders (
    order_reference,
    checkout_token_hash,
    event_id,
    ticket_type_id,
    buyer_name,
    buyer_email,
    buyer_phone,
    quantity,
    admissions_count,
    unit_price_kobo,
    total_amount_kobo,
    status,
    reservation_expires_at
  )
  values (
    v_ref,
    p_checkout_token_hash,
    v_ticket.event_id,
    v_ticket.id,
    trim(p_buyer_name),
    lower(trim(p_buyer_email)),
    trim(p_buyer_phone),
    p_quantity,
    v_admissions,
    v_ticket.price_amount_kobo,
    v_ticket.price_amount_kobo * p_quantity,
    'reserved',
    v_expiry
  )
  returning id into v_order;

  for v_guest in
    select guest.value
    from jsonb_array_elements(p_attendees) as guest(value)
  loop
    v_idx := v_idx + 1;
    v_full_name := trim(v_guest.value ->> 'fullName');

    insert into public.attendees (
      order_id, attendee_number, full_name
    )
    values (v_order, v_idx, v_full_name);
  end loop;

  return jsonb_build_object(
    'orderId', v_order,
    'orderReference', v_ref,
    'quantity', p_quantity,
    'admissionsCount', v_admissions,
    'totalAmountKobo', v_ticket.price_amount_kobo * p_quantity,
    'reservationExpiresAt', v_expiry,
    'status', 'reserved'
  );
end;
$$;

revoke all on function public.create_ticket_order(
  text, integer, text, text, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.create_ticket_order(
  text, integer, text, text, text, jsonb, text
) to service_role;


-- ============================================================
-- 17. TICKET AVAILABILITY
-- ============================================================

create or replace function public.get_ticket_availability()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid bigint := 0;
  v_held bigint := 0;
  v_limit integer;
  v_now timestamptz;
begin
  v_now := clock_timestamp();
  perform public.expire_pending_orders(v_now);

  select early_bird_limit
  into v_limit
  from public.ticket_types
  where id = 'early-bird';

  if not found or v_limit is null or v_limit < 1 then
    raise exception 'TICKET_CONFIGURATION_ERROR';
  end if;

  select
    coalesce(sum(admissions_count) filter (where status = 'paid'), 0),
    coalesce(sum(admissions_count) filter (
      where status in ('reserved', 'payment_submitted')
        and reservation_expires_at > v_now
    ), 0)
  into v_paid, v_held
  from public.orders
  where ticket_type_id = 'early-bird';

  return jsonb_build_object(
    'earlyBird', jsonb_build_object(
      'remaining', greatest(v_limit - v_paid - v_held, 0),
      'open', v_paid + v_held < v_limit
    ),
    'regularOpen', v_paid >= v_limit,
    'friendsOpen', v_paid >= v_limit
  );
end;
$$;

revoke all on function public.get_ticket_availability()
  from public, anon, authenticated;
grant execute on function public.get_ticket_availability()
  to service_role;


-- ============================================================
-- 18. BANK PAYMENT SUBMISSION
-- ============================================================

create or replace function public.submit_bank_payment(
  p_order_reference text,
  p_checkout_token_hash text,
  p_sender_name text,
  p_sender_bank text,
  p_transfer_reference text,
  p_amount_kobo bigint,
  p_receipt_path text,
  p_payment_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment_id uuid;
  v_now timestamptz;
  v_review_expiry timestamptz;
begin
  if coalesce(p_order_reference, '') !~ '^AWN-2026-[A-F0-9]{16}$' then
    raise exception 'INVALID_ORDER_REFERENCE';
  end if;

  if coalesce(p_checkout_token_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_CHECKOUT_TOKEN';
  end if;

  if length(trim(coalesce(p_sender_name, ''))) not between 2 and 120 then
    raise exception 'INVALID_SENDER_NAME';
  end if;

  if p_sender_bank is not null and length(trim(p_sender_bank)) > 100 then
    raise exception 'INVALID_SENDER_BANK';
  end if;

  if length(trim(coalesce(p_transfer_reference, ''))) not between 2 and 120 then
    raise exception 'INVALID_TRANSFER_REFERENCE';
  end if;

  if p_amount_kobo is null or p_amount_kobo <= 0 then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  if length(trim(coalesce(p_receipt_path, ''))) not between 1 and 500 then
    raise exception 'INVALID_RECEIPT_PATH';
  end if;

  if length(trim(coalesce(p_payment_reference, ''))) not between 1 and 128 then
    raise exception 'INVALID_PAYMENT_REFERENCE';
  end if;

  -- Refresh expired order/payment states before checking this order.
  perform public.expire_pending_orders(clock_timestamp());

  select *
  into v_order
  from public.orders
  where
    order_reference = p_order_reference
    and checkout_token_hash = p_checkout_token_hash
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_now := clock_timestamp();

  if v_order.status = 'expired'
     or v_order.reservation_expires_at <= v_now then
    raise exception 'RESERVATION_EXPIRED';
  end if;

  if v_order.status not in ('reserved', 'payment_submitted') then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;

  if p_amount_kobo <> v_order.total_amount_kobo then
    raise exception 'AMOUNT_MISMATCH';
  end if;

  if exists (
    select 1
    from public.payment_submissions
    where order_id = v_order.id
      and status in ('submitted', 'under_review', 'confirmed')
  ) then
    raise exception 'PAYMENT_ALREADY_SUBMITTED';
  end if;

  insert into public.payment_submissions (
    order_id,
    payment_reference,
    sender_name,
    sender_bank,
    transfer_reference,
    amount_kobo,
    receipt_path,
    status
  )
  values (
    v_order.id,
    trim(p_payment_reference),
    trim(p_sender_name),
    nullif(trim(coalesce(p_sender_bank, '')), ''),
    trim(p_transfer_reference),
    p_amount_kobo,
    trim(p_receipt_path),
    'submitted'
  )
  returning id into v_payment_id;

  -- Payment review receives a separate 24-hour deadline.
  v_review_expiry := v_now + interval '24 hours';

  update public.orders
  set
    status = 'payment_submitted',
    reservation_expires_at = v_review_expiry,
    updated_at = v_now
  where id = v_order.id;

  return jsonb_build_object(
    'paymentId', v_payment_id,
    'paymentReference', trim(p_payment_reference),
    'status', 'submitted',
    'orderReference', v_order.order_reference,
    'amountKobo', v_order.total_amount_kobo,
    'reviewExpiresAt', v_review_expiry
  );
end;
$$;

revoke all on function public.submit_bank_payment(
  text, text, text, text, text, bigint, text, text
) from public, anon, authenticated;
grant execute on function public.submit_bank_payment(
  text, text, text, text, text, bigint, text, text
) to service_role;


-- ============================================================
-- 19. ADMIN PAYMENT REVIEW AND TICKET ISSUANCE
-- ============================================================

-- Approval confirms payment and issues one ticket per attendee in
-- the same database transaction. If any ticket insert fails, all
-- approval and ticket changes roll back together.

create or replace function public.admin_review_payment(
  p_payment_id uuid,
  p_admin_user_id uuid,
  p_decision text,
  p_admin_note text,
  p_verified_amount_kobo bigint default null,
  p_bank_transaction_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.admin_role;
  v_pay public.payment_submissions%rowtype;
  v_order public.orders%rowtype;
  v_event public.events%rowtype;
  v_ticket_type public.ticket_types%rowtype;
  v_guest record;
  v_count integer;
  v_code text;
  v_issued_at timestamptz;
  v_tickets jsonb := '[]'::jsonb;
  v_now timestamptz;
begin
  select role
  into v_role
  from public.admin_users
  where user_id = p_admin_user_id and is_active = true
  for share;

  if not found then
    raise exception 'ADMIN_NOT_AUTHORIZED';
  end if;

  if v_role not in ('owner', 'finance') then
    raise exception 'PAYMENT_PERMISSION_DENIED';
  end if;

  if p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception 'INVALID_REVIEW_DECISION';
  end if;

  select * into v_pay
  from public.payment_submissions
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  select * into v_order
  from public.orders
  where id = v_pay.order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_pay.status = 'expired' or v_order.status = 'expired' then
    raise exception 'RESERVATION_EXPIRED';
  end if;

  select * into v_event
  from public.events
  where id = v_order.event_id;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  select * into v_ticket_type
  from public.ticket_types
  where id = v_order.ticket_type_id;

  if not found then
    raise exception 'TICKET_TYPE_NOT_FOUND';
  end if;

  if v_pay.status not in ('submitted', 'under_review') then
    raise exception 'PAYMENT_ALREADY_REVIEWED';
  end if;

  if v_order.status <> 'payment_submitted' then
    raise exception 'ORDER_NOT_AWAITING_REVIEW';
  end if;

  if v_pay.amount_kobo <> v_order.total_amount_kobo then
    raise exception 'SUBMITTED_AMOUNT_MISMATCH';
  end if;

  if p_decision = 'approve' then
    v_now := clock_timestamp();

    if v_order.reservation_expires_at <= v_now then
      raise exception 'RESERVATION_EXPIRED';
    end if;

    if p_verified_amount_kobo is null
       or p_verified_amount_kobo <> v_order.total_amount_kobo then
      raise exception 'BANK_AMOUNT_MISMATCH';
    end if;

    if nullif(trim(coalesce(p_bank_transaction_reference, '')), '') is null then
      raise exception 'BANK_REFERENCE_REQUIRED';
    end if;

    update public.payment_submissions
    set
      status = 'confirmed',
      verified_amount_kobo = p_verified_amount_kobo,
      bank_transaction_reference = trim(p_bank_transaction_reference),
      reviewed_by = p_admin_user_id,
      reviewed_at = v_now,
      admin_note = p_admin_note
    where id = p_payment_id;

    update public.orders
    set status = 'paid', updated_at = v_now
    where id = v_order.id;

    select count(*)
    into v_count
    from public.attendees
    where order_id = v_order.id;

    if v_count <> v_order.admissions_count then
      raise exception 'ATTENDEE_COUNT_MISMATCH';
    end if;

    if exists (
      select 1 from public.tickets where order_id = v_order.id
    ) then
      raise exception 'TICKETS_ALREADY_ISSUED';
    end if;

    for v_guest in
      select id, full_name
      from public.attendees
      where order_id = v_order.id
      order by attendee_number
    loop
      insert into public.tickets (
        event_id,
        order_id,
        attendee_id,
        ticket_type_id,
        ticket_code,
        qr_nonce
      )
      values (
        v_order.event_id,
        v_order.id,
        v_guest.id,
        v_order.ticket_type_id,
        'PENDING',
        'pending'
      )
      returning ticket_code, issued_at
      into v_code, v_issued_at;

      v_tickets := v_tickets || jsonb_build_array(
        jsonb_build_object(
          'ticketCode', v_code,
          'attendeeName', v_guest.full_name,
          'ticketType', v_ticket_type.name,
          'issuedAt', v_issued_at
        )
      );
    end loop;

    if jsonb_array_length(v_tickets) <> v_order.admissions_count then
      raise exception 'TICKET_ISSUANCE_COUNT_MISMATCH';
    end if;

  else
    if length(trim(coalesce(p_admin_note, ''))) < 3 then
      raise exception 'REJECTION_REASON_REQUIRED';
    end if;

    update public.payment_submissions
    set
      status = 'rejected',
      reviewed_by = p_admin_user_id,
      reviewed_at = clock_timestamp(),
      admin_note = p_admin_note
    where id = p_payment_id;

    update public.orders
    set status = 'cancelled', updated_at = clock_timestamp()
    where id = v_order.id;
  end if;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_id, details
  )
  values (
    p_admin_user_id,
    case
      when p_decision = 'approve'
        then 'payment.approved_and_tickets_issued'
      else 'payment.rejected'
    end,
    'payment_submission',
    p_payment_id::text,
    jsonb_build_object(
      'order_reference', v_order.order_reference,
      'decision', p_decision,
      'ticket_count', jsonb_array_length(v_tickets),
      'bank_reference', p_bank_transaction_reference,
      'note', p_admin_note
    )
  );

  return jsonb_build_object(
    'success', true,
    'order_reference', v_order.order_reference,
    'decision', p_decision,
    'order_status', case when p_decision = 'approve' then 'paid' else 'cancelled' end,
    'buyer_email', v_order.buyer_email,
    'buyer_name', v_order.buyer_name,
    'event_name', v_event.name,
    'event_start_at', v_event.event_start_at,
    'venue', v_event.venue,
    'ticket_count', jsonb_array_length(v_tickets),
    'tickets', v_tickets
  );
end;
$$;

revoke all on function public.admin_review_payment(
  uuid, uuid, text, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.admin_review_payment(
  uuid, uuid, text, text, bigint, text
) to service_role;


-- ============================================================
-- 20. CUSTOMER TICKET WALLET
-- ============================================================

create or replace function public.get_order_tickets(
  p_order_reference text,
  p_checkout_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_rows jsonb;
begin
  select * into v_order
  from public.orders
  where
    order_reference = p_order_reference
    and checkout_token_hash = p_checkout_token_hash;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'paid' then
    return jsonb_build_object(
      'status', v_order.status,
      'tickets', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'ticketCode', t.ticket_code,
        'qrNonce', t.qr_nonce,
        'status', t.status,
        'issuedAt', t.issued_at,
        'attendeeName', a.full_name,
        'ticketType', tt.name
      )
      order by t.ticket_number
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.tickets t
  join public.attendees a on a.id = t.attendee_id
  join public.ticket_types tt on tt.id = t.ticket_type_id
  where t.order_id = v_order.id;

  return jsonb_build_object(
    'status', 'paid',
    'orderReference', v_order.order_reference,
    'tickets', v_rows
  );
end;
$$;

revoke all on function public.get_order_tickets(text, text)
  from public, anon, authenticated;
grant execute on function public.get_order_tickets(text, text)
  to service_role;


-- ============================================================
-- 21. GATE TICKET CHECK-IN
-- ============================================================

-- The row lock prevents two simultaneous attempts from checking
-- in the same ticket. Manual textual code is the primary method;
-- QR is optional.

create or replace function public.check_in_ticket(
  p_ticket_code text,
  p_qr_nonce text,
  p_admin_user_id uuid,
  p_verification_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.admin_role;
  v_ticket public.tickets%rowtype;
  v_order public.orders%rowtype;
  v_name text;
  v_type text;
  v_checked timestamptz;
  v_code text;
begin
  v_code := upper(trim(coalesce(p_ticket_code, '')));

  if v_code !~ '^AWN-2026-[A-F0-9]{16}$' then
    return jsonb_build_object('status', 'invalid_ticket');
  end if;

  select role
  into v_role
  from public.admin_users
  where user_id = p_admin_user_id and is_active = true
  for share;

  if not found then
    raise exception 'ADMIN_NOT_AUTHORIZED';
  end if;

  if v_role not in ('owner', 'ticket_manager', 'gate_staff') then
    raise exception 'GATE_PERMISSION_DENIED';
  end if;

  if p_verification_method is null
     or p_verification_method not in ('qr', 'manual')
     or (p_verification_method = 'qr'
         and nullif(trim(coalesce(p_qr_nonce, '')), '') is null)
     or (p_verification_method = 'manual' and p_qr_nonce is not null) then
    raise exception 'INVALID_VERIFICATION_METHOD';
  end if;

  select * into v_ticket
  from public.tickets
  where ticket_code = v_code
  for update;

  if not found then
    return jsonb_build_object('status', 'invalid_ticket');
  end if;

  if p_verification_method = 'qr'
     and v_ticket.qr_nonce <> p_qr_nonce then
    return jsonb_build_object('status', 'invalid_qr');
  end if;

  if v_ticket.status = 'cancelled' then
    return jsonb_build_object('status', 'cancelled');
  end if;

  if v_ticket.status = 'used' then
    select checked_in_at
    into v_checked
    from public.check_ins
    where ticket_id = v_ticket.id;

    return jsonb_build_object(
      'status', 'already_used',
      'ticketCode', v_ticket.ticket_code,
      'checkedInAt', coalesce(v_checked, v_ticket.checked_in_at)
    );
  end if;

  select * into v_order
  from public.orders
  where id = v_ticket.order_id;

  if not found
     or v_order.status <> 'paid'
     or not exists (
       select 1
       from public.payment_submissions p
       where
         p.order_id = v_order.id
         and p.status = 'confirmed'
         and p.verified_amount_kobo = v_order.total_amount_kobo
         and nullif(trim(coalesce(p.bank_transaction_reference, '')), '') is not null
     ) then
    return jsonb_build_object('status', 'payment_not_confirmed');
  end if;

  select full_name into v_name
  from public.attendees
  where id = v_ticket.attendee_id;

  select name into v_type
  from public.ticket_types
  where id = v_ticket.ticket_type_id;

  v_checked := clock_timestamp();

  update public.tickets
  set status = 'used', checked_in_at = v_checked
  where id = v_ticket.id and status = 'active';

  if not found then
    return jsonb_build_object('status', 'already_used');
  end if;

  insert into public.check_ins (
    ticket_id, checked_by, verification_method, checked_in_at
  )
  values (
    v_ticket.id, p_admin_user_id, p_verification_method, v_checked
  );

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_id, details
  )
  values (
    p_admin_user_id,
    'ticket.checked_in',
    'ticket',
    v_ticket.id::text,
    jsonb_build_object(
      'ticket_code', v_ticket.ticket_code,
      'order_reference', v_order.order_reference,
      'method', p_verification_method
    )
  );

  return jsonb_build_object(
    'status', 'valid',
    'ticketCode', v_ticket.ticket_code,
    'attendeeName', v_name,
    'ticketType', v_type,
    'orderReference', v_order.order_reference,
    'verificationMethod', p_verification_method,
    'checkedInAt', v_checked
  );
end;
$$;

revoke all on function public.check_in_ticket(text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.check_in_ticket(text, text, uuid, text)
  to service_role;


-- ============================================================
-- 22. ADMIN DASHBOARD STATISTICS
-- ============================================================

-- Running dashboard statistics also refreshes expiry state, so
-- expired payment submissions do not remain pending indefinitely
-- when the admin dashboard is opened.

create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
begin
  perform public.expire_pending_orders(v_now);

  select jsonb_build_object(
    'verifiedRevenueKobo', coalesce((
      select sum(total_amount_kobo)
      from public.orders
      where status = 'paid'
    ), 0),
    'paidOrders', (
      select count(*) from public.orders where status = 'paid'
    ),
    'paidAdmissions', coalesce((
      select sum(admissions_count)
      from public.orders
      where status = 'paid'
    ), 0),
    'pendingPayments', (
      select count(*)
      from public.payment_submissions
      where status in ('submitted', 'under_review')
    ),
    'checkedInAdmissions', (
      select count(*) from public.tickets where status = 'used'
    ),
    'activeTickets', (
      select count(*) from public.tickets where status = 'active'
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_admin_dashboard_stats()
  from public, anon, authenticated;
grant execute on function public.get_admin_dashboard_stats()
  to service_role;


-- ============================================================
-- 23. PRIVATE PAYMENT RECEIPT STORAGE
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- END OF INITIAL SCHEMA
-- ============================================================
