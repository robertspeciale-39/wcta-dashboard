// POST /api/teams — manage the per-season team registry. Requires X-Admin-Key.
// { action: "add",    season, site, numbers: ["19-1521", ...] }
// { action: "move",   season, number, site }
// { action: "rename", season, number, name }
// { action: "remove", season, number }        (also deletes that team's scores for the season)
const SEASON_RE = /^\d{2}-\d{2}$/;
const NUM_RE = /^[0-9]{1,3}-?[0-9]{1,6}$/;

export async function onRequestPost({ request, env }) {
  if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
    return Response.json({ error: "Invalid passcode" }, { status: 401 });
  }
  let b;
  try { b = await request.json(); } catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }
  if (!SEASON_RE.test(b.season || "")) return Response.json({ error: "season like 26-27 required" }, { status: 400 });
  const siteOk = async (id) => !!(await env.DB.prepare("SELECT id FROM sites WHERE id=?1").bind(id).first());

  if (b.action === "add") {
    if (!(await siteOk(b.site))) return Response.json({ error: "Pick a school first" }, { status: 400 });
    const nums = [...new Set((b.numbers || []).map(n => String(n).trim()).filter(Boolean))];
    const bad = nums.filter(n => !NUM_RE.test(n));
    if (bad.length) return Response.json({ error: "Check these team numbers: " + bad.join(", ") }, { status: 400 });
    const added = [], skipped = [];
    for (const n of nums) {
      const ex = await env.DB.prepare("SELECT site FROM teams WHERE season=?1 AND number=?2").bind(b.season, n).first();
      if (ex) { skipped.push({ number: n, site: ex.site }); continue; }
      await env.DB.prepare("INSERT INTO teams (season, number, name, site) VALUES (?1, ?2, NULL, ?3)").bind(b.season, n, b.site).run();
      added.push(n);
    }
    return Response.json({ ok: true, added, skipped });
  }
  const num = String(b.number || "").trim();
  if (!num) return Response.json({ error: "number required" }, { status: 400 });

  if (b.action === "move") {
    if (!(await siteOk(b.site))) return Response.json({ error: "Unknown school" }, { status: 400 });
    await env.DB.prepare("INSERT INTO teams (season, number, name, site) VALUES (?1, ?2, NULL, ?3) ON CONFLICT(season, number) DO UPDATE SET site=excluded.site")
      .bind(b.season, num, b.site).run();
    return Response.json({ ok: true });
  }
  if (b.action === "rename") {
    const name = (b.name || "").trim().slice(0, 80) || null;
    await env.DB.prepare("UPDATE teams SET name=?3 WHERE season=?1 AND number=?2").bind(b.season, num, name).run();
    if (name) await env.DB.prepare("UPDATE scores SET name=?3 WHERE season=?1 AND number=?2").bind(b.season, num, name).run();
    return Response.json({ ok: true });
  }
  if (b.action === "remove") {
    await env.DB.prepare("DELETE FROM scores WHERE season=?1 AND number=?2").bind(b.season, num).run();
    await env.DB.prepare("DELETE FROM teams WHERE season=?1 AND number=?2").bind(b.season, num).run();
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
