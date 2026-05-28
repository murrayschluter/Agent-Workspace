-- supabase/auth/02_profiles.sql
-- One row per Supabase Auth user. App-level metadata + role.
-- New users land in role='pending' via the provision_profile trigger (file 07).
-- A super_admin promotes them to 'agent' to activate.

create table if not exists profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  display_name   text,
  role           user_role not null default 'pending',
  vault_user_id  text,
  created_at     timestamptz not null default now()
);

create index if not exists profiles_email_idx on profiles (email);
create index if not exists profiles_role_idx  on profiles (role);

-- RLS will be enabled in file 15; policies defined in file 11.
alter table profiles disable row level security;
