// POST /api/entry — save one team's scores for a season/round. Requires X-Admin-Key.
// Partial update: only the fields present in `team` change; everything else is kept.
// Body: { season, round, team: { number, name?, site?, ...score fields } }
//   or  { season, round, meta: { teams_nationwide } }   (round info only)
//   or  { season, round, clear: "<number>" }            (delete that team's row for the round)
const NUM_FIELDS = ["linux","win_desktop","win_server","packet_quiz","packet_image",
  "packet_total","adjust","total","nv_rank","natl_rank","natl_pct",
  "cisco_score","boeing_score","web_score","img_score"];
const TEXT_FIELDS = ["tier","adv"];
const ALL = ["number","name", ...NUM_FIELDS.slice(0,5), "packet_total","adjust","total",
  "nv_rank","natl_rank","natl_pct","tier","adv","cisco_score","boeing_score","web_score","img_score"];
const ROUNDS = ["R1","R2","State","Semis"];
const SEASON_RE = /^\d{2}-\d{2}$/;

export async function onRequestPost({ request, env }) {
  if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
    return Response.json({ error: "Invalid passcode" }, { status: 401 });
  }
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }

  const { season, round } = body || {};
  if (!SEASON_RE.test(season || "") || !ROUNDS.includes(round)) {
    return Response.json({ error: "season (like 26-27) and a valid round are required" }, { status: 400 });
  }
  const ensureMeta = () => env.DB.prepare(
    "INSERT OR IGNORE INTO rounds_meta (season, round, teams_nationwide, date) VALUES (?1, ?2, NULL, NULL)"
  ).bind(season, round).run();

  // Round info only
  if (body.meta) {
    await ensureMeta();
    const n = body.meta.teams_nationwide;
    const v = (n === "" || n == null) ? null : Number(n);
    await env.DB.prepare("UPDATE rounds_meta SET teams_nationwide=?3 WHERE season=?1 AND round=?2")
      .bind(season, round, Number.isFinite(v) ? v : null).run();
    return Response.json({ ok: true });
  }

  // Remove a team's row for this round
  if (body.clear) {
    await env.DB.prepare("DELETE FROM scores WHERE season=?1 AND round=?2 AND number=?3")
      .bind(season, round, String(body.clear)).run();
    return Response.json({ ok: true });
  }

  const team = body.team || {};
  const num = String(team.number || "").trim();
  if (!num) return Response.json({ error: "team.number is required" }, { status: 400 });

  const existing = await env.DB.prepare(
    "SELECT * FROM scores WHERE season=?1 AND round=?2 AND number=?3"
  ).bind(season, round, num).first();

  const row = {};
  for (const f of ALL) row[f] = existing ? existing[f] ?? null : null;
  row.number = num;
  for (const f of NUM_FIELDS) {
    if (!(f in team)) continue;
    const v = team[f];
    const n = (v === null || v === undefined || v === "") ? null : Number(v);
    row[f] = Number.isFinite(n) ? n : null;
  }
  for (const f of TEXT_FIELDS) if (f in team) row[f] = team[f] || null;

  // Name: explicit > existing row > registry > number
  const reg = await env.DB.prepare("SELECT * FROM teams WHERE season=?1 AND number=?2").bind(season, num).first();
  const givenName = typeof team.name === "string" ? team.name.trim() : "";
  row.name = givenName || row.name || (reg && reg.name) || num;

  await env.DB.prepare("DELETE FROM scores WHERE season=?1 AND round=?2 AND number=?3").bind(season, round, num).run();
  await env.DB.prepare(
    `INSERT INTO scores (season, round, number, name,
      linux, win_desktop, win_server, packet_quiz, packet_image, packet_total,
      adjust, total, nv_rank, natl_rank, natl_pct, tier, adv,
      cisco_score, boeing_score, web_score, img_score)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)`
  ).bind(season, round, num, row.name,
    row.linux, row.win_desktop, row.win_server, row.packet_quiz, row.packet_image, row.packet_total,
    row.adjust, row.total, row.nv_rank, row.natl_rank, row.natl_pct, row.tier, row.adv,
    row.cisco_score, row.boeing_score, row.web_score, row.img_score).run();

  // Keep the registry in step (team → school)
  if (!reg) {
    await env.DB.prepare("INSERT OR IGNORE INTO teams (season, number, name, site) VALUES (?1, ?2, ?3, ?4)")
      .bind(season, num, givenName || null, team.site || "unknown").run();
  } else if (givenName && givenName !== reg.name) {
    await env.DB.prepare("UPDATE teams SET name=?3 WHERE season=?1 AND number=?2").bind(season, num, givenName).run();
  }
  await ensureMeta();

  return Response.json({ ok: true, season, round, team: row });
}
