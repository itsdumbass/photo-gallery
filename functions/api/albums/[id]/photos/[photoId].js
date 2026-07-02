import { requireUser } from "../../../_auth.js";
import { getAlbumMembership } from "../../_access.js";

export async function onRequestGet({ request, env, params }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  const membership = await getAlbumMembership(env, params.id, auth.user.id);
  if (!membership) return new Response("Photo not found", { status: 404 });

  const photo = await env.DB.prepare(
    "SELECT * FROM album_photos WHERE id = ? AND album_id = ?"
  )
    .bind(params.photoId, params.id)
    .first();

  if (!photo) return new Response("Photo not found", { status: 404 });

  const object = await env.PHOTOS_BUCKET.get(photo.r2_key);
  if (!object) return new Response("Image file not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": photo.content_type,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function onRequestDelete({ request, env, params }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  const membership = await getAlbumMembership(env, params.id, auth.user.id);
  if (!membership) {
    return Response.json({ error: "Photo not found" }, { status: 404 });
  }

  const photo = await env.DB.prepare(
    "SELECT * FROM album_photos WHERE id = ? AND album_id = ?"
  )
    .bind(params.photoId, params.id)
    .first();

  if (!photo) {
    return Response.json({ error: "Photo not found" }, { status: 404 });
  }

  if (membership.owner_id !== auth.user.id && photo.uploader_id !== auth.user.id) {
    return Response.json({ error: "You cannot delete this photo" }, { status: 403 });
  }

  await env.PHOTOS_BUCKET.delete(photo.r2_key);
  await env.DB.prepare("DELETE FROM album_photos WHERE id = ? AND album_id = ?")
    .bind(params.photoId, params.id)
    .run();

  return Response.json({ success: true });
}
