# QC report: G + D — plan tomorrow in about 10 seconds; a shorter Night ritual

Minnie OK'd this on 2026-11-27 after describing her own habit: too tired to plan at night, and she rarely enters appointments or checklists. See DECISIONS ("G", "D").

| Gate | Result | Evidence |
|---|---|---|
| G1 Static | ✅ | `npm run qc:static`: typecheck, lint, Prettier, i18n (EN = TH), art lint |
| G2 Functional | ✅ | Unit 511/511. The quick-add parser is checked against Thai and English inputs: clock words, am/pm, ranges, next-week days, Thai months, ordinals vs dates, glued weekdays, end times past midnight. The capture fallback has tests for deadlines staying tasks and for keeping tags. Local E2E Chromium: 173 passed, 1 skipped. New `plan-quick.spec` covers the ritual's one question, a one-line appointment, and the morning check in Thai. `night-plan` opens "Edit details" |
| G3 Visual | ⏳ Mac baselines | The ritual's plan step, the Today morning check, and the Next line |
| G4 UX | ✅ | One question plus one tap for a usual day. The editor is folded. A live preview of what was read, with the year when it isn't this one. Touch targets ≥ 44 px; the field has a label and a live region |
| G5 Data & security | ✅ | No migration. Appointments save one event at a time through the existing merge RPC (`patch_day_plan`) |
| G6 Production | ⏳ | After merge: `npm run qc:prod` |
| G7 Independent review | ✅ PASS (third round) | Round 1 FAIL, 6 S2s, all fixed test-first: "8:00pm" read as morning; "3pm-5pm" lost its end; 23:xx ends lasted 24 h; deadline tasks became appointments; "ศุกร์หน้า" meant this week; Thai month names unread. Round 2 FAIL, 1 new S2: "บทที่ 5" read as the 5th, plus glued weekdays. Fixed. Round 3 PASS |

Accepted (S3/S4, from the round 3 review):
- Text with no spaces at all, like "8ธ.ค.บ่าย2", misses the month; the preview shows the date it used instead.
- "8 ธ.ค.นี้" leaves "นี้" as the title.
- "เสาร์อาทิตย์ 10 โมง" picks Saturday.
- A capture with only tokens keeps the tags in its title.

Deferred: pulling appointments from Google Calendar (an .ics URL fetched server-side), after the beta.
