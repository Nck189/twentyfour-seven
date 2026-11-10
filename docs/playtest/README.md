# Playtest runs

Plan: `docs/PLAYTEST_PLAN.md`. Each round lives in `R<n>/`: one folder per persona with a diary per day (`day-NN.md`), up to 2 screenshots per day, and `summary.md`. The round's `REPORT.md` holds the synthesis and the ranked change list.

## How a round runs (local only, never prod)
1. Start local Supabase (Docker), with every migration applied. In a cloud container where Docker Hub/ECR pulls are blocked, use the Google mirror: `/etc/docker/daemon.json` `{"registry-mirrors":["https://mirror.gcr.io"]}`, `dockerd &`, then `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start`.
2. Apply the harness functions as a superuser: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U supabase_admin -d postgres -f tests/playtest/qa-shift-user.sql`.
3. Build and start the app against local Supabase on port 3999.
4. Players drive the UI with `tests/playtest/kit.cjs` (see the header there). They only use the UI. The harness touches the database only for their inbox (`kit.code`) and for the passing of time (`kit.at`, `kit.nextDay`, `kit.skipDays`).

## Known limits of simulated time
- The server's clock is real. A day passes by moving the persona's history back and changing their timezone, so dates on screen stay around the real date. The weekday doesn't change from day to day, so no weekend and no Sunday weekly review in a short round.
- The timezone a persona sees (More/settings) is a harness artefact.
- No push notifications (M11) and no real Home Screen install.
