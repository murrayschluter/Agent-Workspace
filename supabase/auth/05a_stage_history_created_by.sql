-- supabase/auth/05a_stage_history_created_by.sql
-- Follow-up to PR #4 (file 05_listings_ownership.sql), addressing Murray's
-- cross-PR observation during the PR #6 review:
--
-- 05_listings_ownership.sql added `created_by` to 6 of the 7 listings child
-- tables (weekly_logs, contracts, touchpoints, documents, custom_tasks,
-- listing_services), excluding stage_history. The exclusion was based on
-- the assumption that stage_history is purely trigger-populated and has no
-- human-writable surface.
--
-- However, PR #6's 09_rls_children.sql DOES define an INSERT policy on
-- stage_history gated by `can_edit_listing`, which implies app-layer INSERTs
-- ARE expected (and src/lib/stageHistory.js in this repo confirms — the app
-- writes stage transitions directly). For consistency with the other 6
-- children and to preserve the "who recorded this transition" trail, add
-- created_by here.

alter table stage_history
  add column if not exists created_by uuid references auth.users(id);

-- Auto-fill created_by from auth.uid() on INSERT when not explicitly set.
-- Mirrors the set_updated_by pattern on listings (file 07). SECURITY INVOKER
-- so it inherits the caller's auth.uid(); search_path pinned for the
-- function_search_path_mutable linter.
create or replace function set_created_by_stage_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists stage_history_set_created_by on stage_history;
create trigger stage_history_set_created_by
  before insert on stage_history
  for each row execute function set_created_by_stage_history();
