# wcta-dashboard
WCTA CyberPatriot Dashboard — dashboard.wctacyber.org (Cloudflare Pages + D1)

## Tabs
- **WCTA Overview**: West CTA only. Registers, sortable leaderboard, category radar, tier ring + national percentile strip, team trajectory, season × round heatmap.
- **All Sites**: every school combined. Combined leaderboard, site comparison, image vs packet split, radar by school, school trend, school × round heatmap.
- **Schools**: one sub-tab per school, compared head to head with West CTA.
- **Scoreboard**: every row, sortable, with school/tier/round filters and CSV export.
- **Data Entry**: quick-entry grid (season → round → school). Saves on blur. Enter moves down a column.
- **Sites & Teams**: add schools, add team numbers per season, move teams between schools, rename, remove.
- **Analytics / Semi-Finals**: same as before, now filterable by school.

## Files
- `index.html`: the whole front end (no build step)
- `functions/api/data.js`: `GET /api/data` returns seasons, sites, and the team registry
- `functions/api/entry.js`: `POST` saves scores (partial update), round info, or clears a row
- `functions/api/sites.js`: `POST` adds, renames, recolors, or deletes a school
- `functions/api/teams.js`: `POST` adds, moves, renames, or removes a team
- `schema.sql`: **fresh install only** (it drops tables)
- `migrations/001_multi_school.sql`: adds `sites` + `teams` tables and seeds 26-27 R1 and the 25-26 other-school packet scores. Non-destructive and safe to re-run.

All POST routes require the `X-Admin-Key` header, which must match the `ADMIN_KEY` environment variable.

## Upgrading the live database
Run `migrations/001_multi_school.sql` once in Cloudflare → D1 → your database → Console.
Do **not** run `schema.sql` on the live database.
