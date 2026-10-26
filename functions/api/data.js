// GET /api/data — every season/round/team plus the school list and team registry.
// Each score row carries `site` (looked up from the teams registry; West CTA if unknown).
const ROUND_ORDER = ["R1", "R2", "State", "Semis"];
const TEAM_FIELDS = ["number","name","linux","win_desktop","win_server",
  "packet_quiz","packet_image","packet_total","adjust","total",
  "nv_rank","natl_rank","natl_pct","tier","adv",
  "cisco_score","boeing_score","web_score","img_score"];

async function safeAll(env, sql) {
  try { return (await env.DB.prepare(sql).all()).results || []; }
  catch { return null; } // table missing (migration not run yet)
}

export async function onRequestGet({ env }) {
  const meta  = (await safeAll(env, "SELECT * FROM rounds_meta")) || [];
  const rows  = (await safeAll(env, "SELECT * FROM scores")) || [];
  const sites = await safeAll(env, "SELECT * FROM sites ORDER BY sort, name");
  const reg   = (await safeAll(env, "SELECT * FROM teams")) || [];

  const siteOf = new Map(reg.map(t => [t.season + "|" + t.number, t.site]));
  const out = {
    seasons: {},
    sites: sites || [{ id: "west-cta", name: "West CTA", is_home: 1, color: "#00FF41", sort: 0 }],
    teams: reg,
    migrated: sites !== null
  };
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
    team.site = siteOf.get(r.season + "|" + r.number) || "west-cta";
    ensure(r.season, r.round).teams.push(team);
  }
  // Seasons that only have registered teams (no scores yet) still show up
  for (const t of reg) if (!out.seasons[t.season]) out.seasons[t.season] = { rounds: {} };

  for (const s of Object.keys(out.seasons)) {
    const ordered = {};
    for (const rk of ROUND_ORDER) if (out.seasons[s].rounds[rk]) ordered[rk] = out.seasons[s].rounds[rk];
    for (const rk of Object.keys(out.seasons[s].rounds)) if (!ordered[rk]) ordered[rk] = out.seasons[s].rounds[rk];
    out.seasons[s].rounds = ordered;
  }

  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
