// POST /api/entry — save/update one team's scores. Requires X-Admin-Key header.
const NUM_FIELDS = ["linux","win_desktop","win_server","packet_quiz","packet_image",
  "packet_total","adjust","total","nv_rank","natl_rank","natl_pct",
  "cisco_score","boeing_score","web_score","img_score"];
const ROUNDS = ["R1","R2","State","Semis"];

export async function onRequestPost({ request, env }) {
  if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
    return Response.json({ error: "Invalid passcode" }, { status: 401 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }

  const { season, round, team } = body || {};
  if (!season || !ROUNDS.includes(round) || !team || !team.name) {
    return Response.json({ error: "season, valid round, and team.name are required" }, { status: 400 });
  }

  const num = (team.number || "").trim();
  const name = team.name.trim();
  const vals = {};
  for (const f of NUM_FIELDS) {
    const v = team[f];
    vals[f] = (v === null || v === undefined || v === "") ? null : Number(v);
    if (vals[f] !== null && Number.isNaN(vals[f])) vals[f] = null;
  }
  const tier = team.tier || null;
  const adv = team.adv || null;

  // Upsert: remove any existing row for this team in this season/round, then insert
  await env.DB.prepare(
    "DELETE FROM scores WHERE season=?1 AND round=?2 AND ((?3 <> '' AND number=?3) OR name=?4)"
  ).bind(season, round, num, name).run();

  await env.DB.prepare(
    `INSERT INTO scores (season, round, number, name,
      linux, win_desktop, win_server, packet_quiz, packet_image, packet_total,
      adjust, total, nv_rank, natl_rank, natl_pct, tier, adv,
      cisco_score, boeing_score, web_score, img_score)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)`
  ).bind(season, round, num || null, name,
    vals.linux, vals.win_desktop, vals.win_server, vals.packet_quiz, vals.packet_image, vals.packet_total,
    vals.adjust, vals.total, vals.nv_rank, vals.natl_rank, vals.natl_pct, tier, adv,
    vals.cisco_score, vals.boeing_score, vals.web_score, vals.img_score).run();

  // Make sure the season/round exists in metadata
  await env.DB.prepare(
    "INSERT OR IGNORE INTO rounds_meta (season, round, teams_nationwide, date) VALUES (?1, ?2, NULL, NULL)"
  ).bind(season, round).run();

  return Response.json({ ok: true, season, round, name });
}
