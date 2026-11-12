-- G7 R1-fixes F5 (S2): a user could delete their own past block logs, which turned those days into
-- "away" days (R2) — paying the welcome-back gift (R3) and erasing farm misses. The app never deletes
-- a log (a block is undone by clearing fields), so clients lose DELETE; account deletion cascades.
drop policy if exists "own rows: delete" on public.block_logs;
revoke delete on public.block_logs from authenticated;
