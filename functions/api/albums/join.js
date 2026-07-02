import { requireUser } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const inviteCode = String(body.inviteCode || "").trim().toUpperCase();

  if (!inviteCode) {
    return Response.json({ error: "Enter an invite code" }, { status: 400 });
  }

  const album = await env.DB.prepare(
    "SELECT id, name FROM albums WHERE invite_code = ?"
  )
    .bind(inviteCode)
    .first();

  if (!album) {
    return Response.json({ error: "Invite code not found" }, { status: 404 });
  }

  await env.DB.prepare(
    `INSERT OR IGNORE INTO album_members
     (album_id, user_id, user_email, role, joined_at)
     VALUES (?, ?, ?, 'member', ?)`
  )
    .bind(album.id, auth.user.id, auth.user.email || "", new Date().toISOString())
    .run();

  return Response.json(album);
}
