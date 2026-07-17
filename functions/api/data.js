// GET /api/data — returns all seasons/rounds/teams in the shape the dashboard expects
const ROUND_ORDER = ["R1", "R2", "State", "Semis"];
const TEAM_FIELDS = ["number","name","linux","win_desktop","win_server",
  "packet_quiz","packet_image","packet_total","adjust","total",
  "nv_rank","natl_rank","natl_pct","tier","adv",
  "cisco_score","boeing_score","web_score","img_score"];

export async function onRequestGet({ env }) {
  const meta = (await env.DB.prepare("SELECT * FROM rounds_meta").all()).results;
  const rows = (await env.DB.prepare("SELECT * FROM scores").all()).results;

  const out = { seasons: {} };
  const ensure = (season, round) => {
    if (!out.seasons[season]) out.seasons[season] = { rounds: {} };
    if (!out.seasons[season].rounds[round]) out.seasons[season].rounds[round] = { teams: [] };
    return out.seasons[season].rounds[round];
  };

  for (const m of meta) {
    const rd = ensure(m.season, m.round);
    rd.teams_nationwide = m.teams_nationwide;
    rd.date = m.date;
  }
  for (const r of rows) {
    const team = {};
    for (const f of TEAM_FIELDS) team[f] = r[f] ?? null;
    ensure(r.season, r.round).teams.push(team);
  }

  // Order rounds R1 → R2 → State → Semis within each season
  for (const s of Object.keys(out.seasons)) {
    const ordered = {};
    for (const rk of ROUND_ORDER) if (out.seasons[s].rounds[rk]) ordered[rk] = out.seasons[s].rounds[rk];
    for (const rk of Object.keys(out.seasons[s].rounds)) if (!ordered[rk]) ordered[rk] = out.seasons[s].rounds[rk];
    out.seasons[s].rounds = ordered;
  }

  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
