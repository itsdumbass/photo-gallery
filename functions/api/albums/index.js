import { requireUser } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  const { results } = await env.DB.prepare(
    `SELECT a.id, a.name, a.owner_id, a.invite_code, a.created_at, m.role,
       (SELECT COUNT(*) FROM album_members am WHERE am.album_id = a.id) AS member_count,
       (SELECT COUNT(*) FROM album_photos ap WHERE ap.album_id = a.id) AS photo_count
     FROM albums a
     INNER JOIN album_members m ON m.album_id = a.id
     WHERE m.user_id = ?
     ORDER BY a.created_at DESC`
  )
    .bind(auth.user.id)
    .all();

  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();

  if (!name || name.length > 80) {
    return Response.json({ error: "Album name must be 1 to 80 characters" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const inviteCode = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const createdAt = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO albums (id, name, owner_id, invite_code, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, name, auth.user.id, inviteCode, createdAt),
    env.DB.prepare(
      `INSERT INTO album_members
       (album_id, user_id, user_email, role, joined_at)
       VALUES (?, ?, ?, 'owner', ?)`
    ).bind(id, auth.user.id, auth.user.email || "", createdAt),
  ]);

  return Response.json({ id, name, inviteCode }, { status: 201 });
}
