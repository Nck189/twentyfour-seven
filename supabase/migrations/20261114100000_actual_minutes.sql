-- M14 estimate vs actual (SPEC §9 "planning-fallacy analytics"): a finished task with an estimate
-- can record how long it really took (one tap after finishing). Own rows only (existing RLS); no
-- coins or rewards depend on it.
alter table public.backlog_items
  add column if not exists actual_min integer check (actual_min between 1 and 1440);
