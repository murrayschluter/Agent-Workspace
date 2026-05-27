-- =============================================================================
-- Auto-record every listing stage transition into stage_history.
-- Run this once in the Supabase SQL editor after schema.sql.
-- Idempotent — safe to re-run.
--
-- Why a trigger (not app code): guarantees every stage change is logged,
-- atomically with the update, regardless of which client made it
-- (React app, SQL editor, future admin tools, manual fixes).
-- =============================================================================

create or replace function record_stage_history()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    insert into stage_history (listing_id, from_stage, to_stage)
    values (new.id, null, new.stage);
    return new;
  elsif (tg_op = 'UPDATE' and new.stage is distinct from old.stage) then
    insert into stage_history (listing_id, from_stage, to_stage)
    values (new.id, old.stage, new.stage);
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_record_stage_history on listings;
create trigger listings_record_stage_history
  after insert or update on listings
  for each row
  execute function record_stage_history();
