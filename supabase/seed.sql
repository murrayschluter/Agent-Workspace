-- =============================================================================
-- Seed data — three [DEMO] listings, one per dashboard section.
-- Run AFTER schema.sql and triggers.sql, in the Supabase SQL editor.
-- Click "Run without RLS" when prompted.
--
-- All addresses prefixed [DEMO] and vendor names ending in "Demo" so they're
-- obviously not real — delete the seed block below to clear them out.
-- =============================================================================

-- To wipe seed data and start fresh, uncomment and run this block:
-- delete from listings where id in (
--   '11111111-1111-1111-1111-111111111111',
--   '22222222-2222-2222-2222-222222222222',
--   '33333333-3333-3333-3333-333333333333'
-- );

-- =============================================================================
-- 1. [DEMO] Under Contract — has active contract with mixed-urgency conditions
-- =============================================================================
insert into listings (
  id, address, vendor_names, vendor_phones, vendor_emails,
  campaign_type, list_date, stage
) values (
  '11111111-1111-1111-1111-111111111111',
  '[DEMO] 35 Parkway Terrace, Mango Hill QLD 4509',
  array['Tom Demo', 'Lisa Demo'],
  array['0400 000 001'],
  array['demo1@example.com'],
  'private_treaty',
  '2026-03-15',
  'under_contract'
);

insert into contracts (
  listing_id, contract_date, settlement_date, purchase_price, conditions, is_active
) values (
  '11111111-1111-1111-1111-111111111111',
  '2026-05-08',
  '2026-06-19',
  1240000,
  '[
    {"type": "finance",        "due_date": "2026-05-25"},
    {"type": "building_pest",  "due_date": "2026-05-30"},
    {"type": "body_corporate", "due_date": "2026-06-05"}
  ]'::jsonb,
  true
);

-- =============================================================================
-- 2. [DEMO] Active Campaign — with one weekly log and one sent touchpoint
-- =============================================================================
insert into listings (
  id, address, vendor_names, vendor_phones, vendor_emails,
  campaign_type, list_date, stage
) values (
  '22222222-2222-2222-2222-222222222222',
  '[DEMO] 7 Chelmsford Road, Mango Hill QLD 4509',
  array['Michael Demo'],
  array['0400 000 002'],
  array['demo2@example.com'],
  'private_treaty',
  '2026-05-03',
  'launched_online'
);

insert into weekly_logs (
  listing_id, week_ending, enquiry_count, inspection_count, open_home_groups,
  price_feedback, notes
) values (
  '22222222-2222-2222-2222-222222222222',
  '2026-05-23', 4, 3, 2,
  'Buyers indicating around the $760k mark, feedback is price is slightly high for the area.',
  'Strong weekend turnout. Two parties interested but waiting for finance.'
);

insert into touchpoints (
  listing_id, type, generated_content, sent_at
) values (
  '22222222-2222-2222-2222-222222222222',
  'monday_report',
  'Hi Michael, quick wrap on the weekend — had 2 groups through the open, both serious buyers from the local area. One has finance in place and is putting an offer together this week. Feedback on price is sitting around the $760k mark from the wider market, will chat tomorrow about where you want to position.',
  '2026-05-20T08:30:00Z'
);

-- =============================================================================
-- 3. [DEMO] Archived — settled listing with successful contract
-- =============================================================================
insert into listings (
  id, address, vendor_names, vendor_phones, vendor_emails,
  campaign_type, list_date, stage
) values (
  '33333333-3333-3333-3333-333333333333',
  '[DEMO] 6 Peel Street, Holmview QLD 4207',
  array['John Demo'],
  array['0400 000 003'],
  array['demo3@example.com'],
  'private_treaty',
  '2026-01-12',
  'archived'
);

insert into contracts (
  listing_id, contract_date, settlement_date, purchase_price, conditions, is_active
) values (
  '33333333-3333-3333-3333-333333333333',
  '2026-03-01', '2026-04-05', 720000,
  '[]'::jsonb, true
);
