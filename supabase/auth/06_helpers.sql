-- supabase/auth/06_helpers.sql
-- Helper functions used by RLS policies. SECURITY DEFINER so the function
-- can read profiles even when called from a row-level context.

create or replace function is_super_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where user_id = check_user_id and role = 'super_admin'
  );
$$;

create or replace function can_read_listing(check_user_id uuid, check_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_super_admin(check_user_id)
    or exists (
      select 1 from listings
      where id = check_listing_id and owner_id = check_user_id
    )
    or exists (
      select 1 from listing_collaborators
      where listing_id = check_listing_id and user_id = check_user_id
    );
$$;

create or replace function can_edit_listing(check_user_id uuid, check_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    is_super_admin(check_user_id)
    or exists (
      select 1 from listings
      where id = check_listing_id and owner_id = check_user_id
    )
    or exists (
      select 1 from listing_collaborators
      where listing_id = check_listing_id
        and user_id = check_user_id
        and level in ('editor', 'co_owner')
    );
$$;
