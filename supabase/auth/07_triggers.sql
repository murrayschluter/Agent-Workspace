-- supabase/auth/07_triggers.sql
-- Triggers for updated_by auto-fill, profile auto-provisioning, and the
-- "last super_admin cannot demote self" safety check.

-- Auto-fill updated_by on UPDATE to listings.
create or replace function set_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists listings_set_updated_by on listings;
create trigger listings_set_updated_by
  before update on listings
  for each row execute function set_updated_by();

-- Auto-provision: new auth.users row -> pending profile, domain-restricted.
create or replace function provision_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.email is null or new.email not like '%@blacpg.com.au' then
    raise exception 'Only @blacpg.com.au accounts may be provisioned. Got: %', new.email;
  end if;
  insert into profiles (user_id, email, role)
  values (new.id, new.email, 'pending')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function provision_profile();

-- Prevent last super_admin from demoting themselves.
create or replace function prevent_last_super_admin_demotion()
returns trigger
language plpgsql
as $$
declare
  super_admin_count int;
begin
  if old.role = 'super_admin' and new.role <> 'super_admin' then
    select count(*) into super_admin_count from profiles where role = 'super_admin';
    if super_admin_count <= 1 then
      raise exception 'Cannot demote the last super_admin. Promote another super_admin first.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_last_super_admin_demotion on profiles;
create trigger profiles_prevent_last_super_admin_demotion
  before update on profiles
  for each row execute function prevent_last_super_admin_demotion();
