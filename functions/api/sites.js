// POST /api/sites — manage schools. Requires X-Admin-Key.
// { action: "add",    name, color? }
// { action: "rename", id, name }
// { action: "color",  id, color }
// { action: "delete", id }          (only when no teams are assigned to it)
const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function onRequestPost({ request, env }) {
  if (request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
    return Response.json({ error: "Invalid passcode" }, { status: 401 });
  }
  let b;
  try { b = await request.json(); } catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }
  const name = (b.name || "").trim().replace(/\s+/g, " ").slice(0, 60);

  if (b.action === "add") {
    const id = slug(name);
    if (!id) return Response.json({ error: "Enter a school name" }, { status: 400 });
    const dup = await env.DB.prepare("SELECT id FROM sites WHERE id=?1").bind(id).first();
    if (dup) return Response.json({ error: name + " is already on the list" }, { status: 409 });
    const max = await env.DB.prepare("SELECT MAX(sort) AS m FROM sites WHERE id <> 'unknown'").first();
    await env.DB.prepare("INSERT INTO sites (id, name, is_home, color, sort) VALUES (?1, ?2, 0, ?3, ?4)")
      .bind(id, name, COLOR_RE.test(b.color || "") ? b.color : null, ((max && max.m) || 0) + 10).run();
    return Response.json({ ok: true, id });
  }
  if (!b.id) return Response.json({ error: "id required" }, { status: 400 });

  if (b.action === "rename") {
    if (!name) return Response.json({ error: "Enter a name" }, { status: 400 });
    await env.DB.prepare("UPDATE sites SET name=?2 WHERE id=?1").bind(b.id, name).run();
    return Response.json({ ok: true });
  }
  if (b.action === "color") {
    if (!COLOR_RE.test(b.color || "")) return Response.json({ error: "Color must look like #00FF41" }, { status: 400 });
    await env.DB.prepare("UPDATE sites SET color=?2 WHERE id=?1").bind(b.id, b.color).run();
    return Response.json({ ok: true });
  }
  if (b.action === "delete") {
    if (b.id === "west-cta" || b.id === "unknown") return Response.json({ error: "This site can't be removed" }, { status: 400 });
    const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM teams WHERE site=?1").bind(b.id).first();
    if (used && used.n) return Response.json({ error: "Move or remove its teams first" }, { status: 409 });
    await env.DB.prepare("DELETE FROM sites WHERE id=?1").bind(b.id).run();
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
