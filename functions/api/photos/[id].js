import { requireUser } from "../_auth.js";

export async function onRequestGet({ request, params, env }) {
  const auth = await requireUser(request, env);

  if (auth.error) {
    return auth.error;
  }

  const photo = await env.DB.prepare(
    "SELECT * FROM photos WHERE id = ? AND user_id = ?"
  )
    .bind(params.id, auth.user.id)
    .first();

  if (!photo) {
    return new Response("Photo not found", { status: 404 });
  }

  const object = await env.PHOTOS_BUCKET.get(photo.r2_key);

  if (!object) {
    return new Response("Image file not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": photo.content_type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function onRequestDelete({ request, params, env }) {
  const auth = await requireUser(request, env);

  if (auth.error) {
    return auth.error;
  }

  const photo = await env.DB.prepare(
    "SELECT * FROM photos WHERE id = ? AND user_id = ?"
  )
    .bind(params.id, auth.user.id)
    .first();

  if (!photo) {
    return Response.json({ error: "Photo not found" }, { status: 404 });
  }

  await env.PHOTOS_BUCKET.delete(photo.r2_key);

  await env.DB.prepare("DELETE FROM photos WHERE id = ? AND user_id = ?")
    .bind(params.id, auth.user.id)
    .run();

  return Response.json({ success: true });
}