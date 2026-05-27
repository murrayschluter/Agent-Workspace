-- =============================================================================
-- Listing Lifecycle Portal — Supabase schema (V1)
-- Single user (Murray). RLS disabled. No auth.
-- Paste into Supabase SQL editor and run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type listing_stage as enum (
    'listed',
    'photos_taken',
    'tenants_contacted',
    'launched_online',
    'under_contract',
    'unconditional',
    'settlement',
    'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type campaign_type as enum (
    'private_treaty',
    'auction',
    'eoi'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type touchpoint_type as enum (
    'monday_report',
    'wednesday_sms',
    'friday_sms'
  );
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- listings
-- -----------------------------------------------------------------------------
create table if not exists listings (
  id              uuid primary key default gen_random_uuid(),
  address         text not null,
  rea_url         text,
  vendor_names    text[] not null default '{}',
  vendor_phones   text[] not null default '{}',
  vendor_emails   text[] not null default '{}',
  campaign_type   campaign_type not null default 'private_treaty',
  list_date       date not null default current_date,
  is_tenanted     boolean not null default false,
  stage           listing_stage not null default 'listed',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists listings_stage_idx       on listings (stage);
create index if not exists listings_list_date_idx   on listings (list_date desc);

-- -----------------------------------------------------------------------------
-- weekly_logs
-- One row per week, per listing. Murray enters this manually after each week.
-- Feeds AI touchpoint generation.
-- -----------------------------------------------------------------------------
create table if not exists weekly_logs (
  id                 uuid primary key default gen_random_uuid(),
  listing_id         uuid not null references listings(id) on delete cascade,
  week_ending        date not null,
  enquiry_count      int  not null default 0,
  inspection_count   int  not null default 0,
  open_home_groups   int  not null default 0,
  offers_received    boolean not null default false,
  offer_amount       numeric(12, 2),
  price_feedback     text,
  notes              text,
  created_at         timestamptz not null default now(),
  unique (listing_id, week_ending)
);

create index if not exists weekly_logs_listing_idx       on weekly_logs (listing_id);
create index if not exists weekly_logs_week_ending_idx   on weekly_logs (listing_id, week_ending desc);

-- -----------------------------------------------------------------------------
-- contracts
-- Multiple contracts per listing supported (for fell-over scenarios).
-- is_active = true means this is the currently-live contract. Set to false
-- when the listing falls over; the row is retained for history.
--
-- conditions jsonb shape: [{ "type": "finance" | "building_pest" | "firb" |
--   "body_corporate" | "other", "label": "optional free text (used for other)",
--   "due_date": "YYYY-MM-DD", "cleared_at": null | "YYYY-MM-DD" }, ...]
-- -----------------------------------------------------------------------------
create table if not exists contracts (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references listings(id) on delete cascade,
  contract_date     date not null,
  settlement_date   date,
  purchase_price    numeric(12, 2),
  conditions        jsonb not null default '[]'::jsonb,
  is_active         boolean not null default true,
  fell_over_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists contracts_listing_idx        on contracts (listing_id);
create unique index if not exists contracts_one_active
  on contracts (listing_id) where is_active = true;

-- -----------------------------------------------------------------------------
-- touchpoints
-- AI-generated drafts. sent_at is null until Murray marks as sent.
-- -----------------------------------------------------------------------------
create table if not exists touchpoints (
  id                 uuid primary key default gen_random_uuid(),
  listing_id         uuid not null references listings(id) on delete cascade,
  type               touchpoint_type not null,
  generated_content  text not null,
  sent_at            timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists touchpoints_listing_idx     on touchpoints (listing_id);
create index if not exists touchpoints_created_at_idx  on touchpoints (listing_id, created_at desc);

-- -----------------------------------------------------------------------------
-- stage_history
-- Audit trail of every stage transition, including fell-over reversions.
-- from_stage is null only for the initial row when the listing is created.
-- -----------------------------------------------------------------------------
create table if not exists stage_history (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references listings(id) on delete cascade,
  from_stage   listing_stage,
  to_stage     listing_stage not null,
  changed_at   timestamptz not null default now()
);

create index if not exists stage_history_listing_idx on stage_history (listing_id, changed_at desc);

-- -----------------------------------------------------------------------------
-- updated_at trigger on listings
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on listings;
create trigger listings_set_updated_at
  before update on listings
  for each row
  execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: explicitly disabled for V1 (single user, no auth).
-- Re-enable + write policies when you add auth in a later phase.
-- -----------------------------------------------------------------------------
alter table listings       disable row level security;
alter table weekly_logs    disable row level security;
alter table contracts      disable row level security;
alter table touchpoints    disable row level security;
alter table stage_history  disable row level security;
