-- supabase/auth/18_stamp_created_by_children.sql
-- Stamp created_by on the child tables that were silently leaving it NULL.
--
-- Found during the post-Phase-6 write-path audit. Every child table has a
-- created_by column, but only stage_history actually populates it (via its
-- own set_created_by_stage_history trigger, added in PR #7). The other six —
-- contracts, touchpoints, documents, custom_tasks, listing_services,
-- weekly_logs — have NO before-insert trigger, and none of the client insert
-- helpers (src/lib/*.js) set created_by. Result: every row in those six
-- tables records created_by = NULL.
--
-- Severity: hygiene, not functional. These tables' INSERT policies are
-- `can_edit_listing(auth.uid(), listing_id)`, which doesn't depend on
-- created_by — so writes succeed regardless (unlike the listings insert bug
-- in #24, where the missing owner_id actually blocked regular agents). And
-- created_by isn't surfaced in the UI yet. But the app already has an audit
-- posture (admin_access_log, stage_history attribution), and "who added this
-- contract / document / touchpoint" is exactly the kind of thing that audit
-- posture will want. Capturing it now is far cheaper than backfilling NULLs
-- after the data accumulates.
--
-- Fix: one generic SECURITY INVOKER trigger function (same body and posture as
-- set_created_by_stage_history) attached BEFORE INSERT to the six tables.
-- INVOKER is correct — auth.uid() resolves in the caller's request context and
-- no elevated privilege is needed. Explicit values are preserved (only NULL is
-- defaulted), so a service-role import or backfill that knows the real creator
-- keeps its value.
--
-- stage_history is intentionally left alone — its existing trigger already
-- does this; re-stamping it here would be redundant churn.
--
-- Verified on staging: inserted a row into each of the six tables as an
-- authenticated owner (rolled back) and confirmed created_by came back as the
-- caller's uid. This also doubles as a functional smoke test of the child
-- write paths under RLS — all six inserts succeed for the listing owner.

create or replace function set_created_by()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists contracts_set_created_by on contracts;
create trigger contracts_set_created_by
  before insert on contracts
  for each row execute function set_created_by();

drop trigger if exists touchpoints_set_created_by on touchpoints;
create trigger touchpoints_set_created_by
  before insert on touchpoints
  for each row execute function set_created_by();

drop trigger if exists documents_set_created_by on documents;
create trigger documents_set_created_by
  before insert on documents
  for each row execute function set_created_by();

drop trigger if exists custom_tasks_set_created_by on custom_tasks;
create trigger custom_tasks_set_created_by
  before insert on custom_tasks
  for each row execute function set_created_by();

drop trigger if exists listing_services_set_created_by on listing_services;
create trigger listing_services_set_created_by
  before insert on listing_services
  for each row execute function set_created_by();

drop trigger if exists weekly_logs_set_created_by on weekly_logs;
create trigger weekly_logs_set_created_by
  before insert on weekly_logs
  for each row execute function set_created_by();
