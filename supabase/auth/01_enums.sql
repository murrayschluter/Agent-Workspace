-- supabase/auth/01_enums.sql
-- Enums for role-based access control. Apply in staging first, never run
-- directly against production until backfill (file 14) and RLS enable
-- (file 15) are also ready.

do $$ begin
  create type user_role as enum ('super_admin', 'agent', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type collab_level as enum ('viewer', 'editor', 'co_owner');
exception when duplicate_object then null; end $$;
