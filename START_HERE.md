# START HERE — Autopilot brief for Claude Code

Minnie, the owner, has already worked out the whole product with Claude in chat and doesn't want to go back and forth here. **Your job is to build the entire app, M0 → M14, with as few interruptions as possible.**

Read these first, in this order:
1. `CLAUDE.md`
2. `docs/SPEC.md`
3. `docs/BUILD_PLAN.md`
4. `docs/PROGRESS.md` (if it exists)

---

## Golden rules
1. **The spec is the boss.** Every decision in `docs/SPEC.md` and `CLAUDE.md` is final, so never re-ask anything answered there.
2. **Unclear detail?** Pick the option most consistent with the spec. Log it in `docs/DECISIONS.md` (date · decision · why · how to change it) and keep going.
3. **Never ask "should I continue?"** and never wait for plan approval. When a milestone is done, start the next one.
4. **Interrupt Minnie only for:**
   - (a) one-time logins or account steps that need her browser
   - (b) values only she can provide
   - (c) the checkpoints listed below
   - (d) anything that costs money or can't be undone (paid plans, deleting data, force push)

   Batch everything into **one** message: a numbered list in Thai, with each step as short as possible.
5. **Talk to her in casual Thai mixed with English tech words**, max ~5 lines per message.
6. **End-of-milestone message format:**
   `✅ M<x> เสร็จ — ลองได้ที่ <url> · เปลี่ยนอะไร: <1–2 lines> · ต่อไป: M<x+1>`
7. **Progress memory:** keep `docs/PROGRESS.md` current, with these sections:
   - current milestone
   - done
   - next concrete step
   - blockers
   - URLs

   If a session starts fresh, or Minnie types "ทำต่อ" / "continue", re-read the files above and resume from PROGRESS.md.
8. **If you hit the same error 3 times**, write it under Blockers in PROGRESS.md and ask Minnie ONE clear question (or search the docs first).

---

## Phase 0 — Environment & accounts (do this yourself, first)
- **Project root** is this folder. Its path contains spaces (`24 7 project`), so always quote paths.
  - npm package name: `twentyfour-seven`.
  - If `create-next-app .` rejects the folder name, scaffold in a temp dir named `twentyfour-seven` and move the files here.
  - Don't overwrite `CLAUDE.md`, `START_HERE.md`, `README.md`, `docs/` or `.gitignore` (append to `.gitignore` if needed).
- **Permissions:** Minnie runs you in `acceptEdits` mode and approves common commands once with "don't ask again". Prefer standard commands (npm, npx, git, gh, supabase, vercel) so approvals stay few.
- **Tools:** check Node ≥ 20, git, GitHub CLI (`gh`), Supabase CLI and Vercel CLI.
  - Install anything missing with Homebrew or `npm i -g`.
  - If Homebrew itself is missing, give Minnie the one-line install command (it needs her Mac password).
- **Logins:** batch them into a single message to Minnie ("กด login ในเบราว์เซอร์ที่เด้งขึ้นมา ทีละอัน"):
  - `gh auth login --web`
  - `supabase login`
  - `vercel login`
- **Git:** `git init` → create the private GitHub repo `twentyfour-seven` with `gh` → first commit + push.
- **Supabase:**
  - Create the project with the CLI: name `twentyfour-seven`, region Singapore (`ap-southeast-1`), free plan.
  - Generate a strong DB password and save it in `.env.local` (gitignored). Tell Minnie where it is.
  - Run `supabase link`.
  - If the CLI can't create the project, ask Minnie to create it in the dashboard and paste the project ref (one message).
- **Vercel:**
  - Link the project and connect the GitHub repo so every push auto-deploys.
  - Add env vars for production, preview and development with `vercel env add`.
- **Auth:**
  - Start with **email magic link only.** Google OAuth needs Google Cloud setup, so it's optional in M14.
  - Set Site URL and redirect URLs (localhost:3000 + the Vercel domain) via `supabase config push` or the Management API. If that isn't possible, give Minnie the exact clicks.
- Create `docs/PROGRESS.md` and `docs/DECISIONS.md`, then start M0.

## Per-milestone loop (M0 → M14, from docs/BUILD_PLAN.md)
1. Read the milestone and write a 3–6 line plan into PROGRESS.md. Include which critical journeys (QA_QC §3) and invariants (§6) this milestone adds or touches.
2. Implement it, writing tests alongside the code (not after).
3. **QA/QC: run gates G1–G5 from `docs/QA_QC.md`.**
   - Visual QC means rendering the full matrix (§2), looking at every screenshot yourself, scoring the rubric (§4.3), and running art lint.
   - Fix-loop until everything passes (max 3 attempts per gate).
4. Commit + push (Vercel deploys), then run **G6** against the live URL.
5. Run **G7**: launch a fresh subagent with `docs/qa/REVIEWER_PROMPT.md`. Fix its S1/S2 findings and re-review once.
6. Write `docs/qa/M<x>-report.md` from the template, and update the Status section in BUILD_PLAN.md and PROGRESS.md.
7. Send the ✅ message **with the QC line**, then start the next milestone immediately:
   `✅ M<x> เสร็จ — ลองได้ที่ <url> · เปลี่ยนอะไร: <1–2 lines> · QC ✅ G1–G7 · tests <n>/<n> · visual <avg>/5 · known: <n> · ต่อไป: M<x+1>`

Minnie should never be the one who finds an S1/S2 bug. If she reports one:
- treat it as a QC escape
- add a regression test
- add the missing check to QA_QC.md so it can't escape again

## Minnie's involvement (she wants as few rounds as possible)
**The only blocking step is the Phase 0 logins.** Everything else is notify-and-continue: tell her, keep building, and apply her feedback whenever it arrives (as the top item of the current milestone).
- **After M0:** give her 3 lines on adding the PWA to the iPhone Home Screen and logging in.
- **M6 art:**
  - `open screenshots/` and say "ดูรูปฟาร์มได้ ไม่ต้องตอบก็ได้ ถ้าไม่ชอบตรงไหนบอก".
  - Your own visual QC (QA_QC §4) must already have passed. She is not your QA.
- **M7 gacha:** "ลองกดกาชาบน iPhone ได้แล้ว".
- **After M10:** "v1 พร้อมใช้แล้ว". She starts using it daily while you continue v2.
- **M11:** give the steps to tap "Enable notifications" in the home-screen app. Until she does, test push end to end with a test subscription.

## Hard safety rules
- Never commit secrets (`.env*` is gitignored; double-check before every commit).
- Never run destructive commands against the linked remote DB (e.g. `supabase db reset --linked`). Use migrations only.
- Never force-push. Never upgrade any paid plan. Never delete Minnie's files outside this project.
- Free tiers only. Add the keep-alive cron (SPEC §1) in M0.

## Decisions already made with Minnie (summary — SPEC.md has the details)
- **Name:** "24/7". Display name "24/7"; the public name gets decided later.
- **Language:** English default + Thai toggle.
- **Art:** style A — flat, no outlines, pastel.
- **Wake targets:**
  - 10:00 on free days and weekends
  - 07:30 on Wed class days, and on Thu if attending
  - Kaizen shift is optional
- **Exercise:** 3×/week; gym closes 22:00.
- **Penalties:** weeds → wilt → dead-to-compost, scaled by severity; none for planned deviations or vacation.
- **Gacha:** full animation + sound (skippable), pity, Seed-dex. Animals and the factory are wanted.
- **Sharing:** free/busy link that works without an account; booking requests need her approval.
- **Stack:** Supabase from day 1, PWA on iPhone/iPad/Mac. v1 → v2 built continuously.
