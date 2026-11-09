-- Streak milestones (G7 R-M9-6, Minnie: "เอาที่คิดว่าดีเลย"): 7, 14 and 30 pay the first time the
-- best streak reaches them (once per account, so breaking and restarting never pays them again);
-- after 30 a running streak pays +5 every 30 days (60, 90, …). Keeping a streak is never worth
-- less than restarting it. Mirrors lib/game/streak.ts streakMilestone (content/game.ts).
create or replace function public.settle_days()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gs public.game_state;
  tz text;
  today date;
  d date;
  first_day date;
  m text;
  is_wake boolean;
  is_min boolean;
  v_reason text;
  o real;
  k text;
  settled jsonb := '[]'::jsonb;
  granted jsonb := '[]'::jsonb;
  v_streak integer;
  v_best integer;
  v_freezes integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into gs from public.game_state where user_id = uid for update;
  if not found then
    raise exception 'no game state' using errcode = 'P0002';
  end if;
  select timezone into tz from public.profiles where user_id = uid;
  today := public._wake_day(uid);
  select greatest(
           coalesce((select max(r.date) + 1 from public.day_results r where r.user_id = uid),
                    -- The sign-up day counts only if it had a wake (signing up at 14:00 isn't a miss).
                    (select c.d + case when exists (select 1 from public.wake_events w
                                                     where w.user_id = uid and w.date = c.d) then 0 else 1 end
                       from (select (p.created_at at time zone coalesce(tz, 'Asia/Bangkok'))::date as d
                               from public.profiles p where p.user_id = uid) c)),
           today - 60)
    into first_day;
  v_streak := gs.streak;
  v_best := gs.best_streak;
  v_freezes := gs.freezes;

  d := first_day;
  while d < today loop
    select mode into m from public.day_plans where user_id = uid and date = d;
    if coalesce(m, 'normal') <> 'normal' then
      k := 'paused';
      o := null;
    else
      is_wake := exists (select 1 from public.wake_events w
                         where w.user_id = uid and w.date = d and w.in_window and not w.backfilled);
      is_min := is_wake
            and exists (select 1 from public.ticket_grants g
                        where g.user_id = uid and g.reason = 'night' and g.ref_date = d);
      o := public._day_oee(uid, d);
      if not is_min and is_wake and public._late_night_planned(uid, d) then
        -- A planned late night: no penalty, but no +1 either (SPEC §8.4, G7 R-M9-2).
        k := 'paused';
      elsif is_min then
        k := case when o is not null and o >= 0.8 then 'perfect' else 'minimum' end;
        v_streak := v_streak + 1;
        -- 7/14/30 pay the first time the best streak reaches them; after 30, every 30 days.
        v_reason := case
          when v_streak in (7, 14, 30) and v_streak > v_best then 'streak_' || v_streak
          when v_streak > 30 and v_streak % 30 = 0 then 'streak_30'
        end;
        v_best := greatest(v_best, v_streak);
        if v_streak % 7 = 0 then
          v_freezes := least(2, v_freezes + 1);
        end if;
        if v_reason is not null and public._grant_once(uid, v_reason, d, 5) then
          granted := granted || jsonb_build_object('reason', v_reason, 'date', d, 'amount', 5,
                                                   'days', v_streak);
        end if;
        if k = 'perfect' and public._grant_once(uid, 'perfect_day', d, 1) then
          granted := granted || jsonb_build_object('reason', 'perfect_day', 'date', d, 'amount', 1);
        end if;
      elsif v_freezes > 0 then
        k := 'frozen';
        v_freezes := v_freezes - 1;
      else
        k := 'missed';
        v_streak := 0;
      end if;
    end if;
    insert into public.day_results (user_id, date, kind, oee) values (uid, d, k, o)
    on conflict do nothing;
    settled := settled || jsonb_build_object('date', d, 'kind', k);
    d := d + 1;
  end loop;

  update public.game_state set streak = v_streak, best_streak = v_best, freezes = v_freezes
  where user_id = uid;
  if jsonb_array_length(settled) > 0 then
    insert into public.events (user_id, type, payload)
    values (uid, 'days_settled', jsonb_build_object('days', settled, 'tickets', granted));
  end if;
  return jsonb_build_object('settled', settled, 'granted', granted, 'streak', v_streak,
                            'best', v_best, 'freezes', v_freezes, 'today', today);
end $$;
revoke all on function public.settle_days() from public, anon;
grant execute on function public.settle_days() to authenticated;
