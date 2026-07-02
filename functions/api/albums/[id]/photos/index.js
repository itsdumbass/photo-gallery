import { requireUser } from "../../../_auth.js";
import { getAlbumMembership } from "../../_access.js";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

export async function onRequestGet({ request, env, params }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  const membership = await getAlbumMembership(env, params.id, auth.user.id);
  if (!membership) {
    return Response.json({ error: "Album not found" }, { status: 404 });
  }

  const { results } = await env.DB.prepare(
    `SELECT id, album_id, uploader_id, uploader_email, filename, content_type, created_at
     FROM album_photos WHERE album_id = ? ORDER BY created_at DESC`
  )
    .bind(params.id)
    .all();

  return Response.json({
    album: membership,
    photos: results.map((photo) => ({
      ...photo,
      imageUrl: `/api/albums/${params.id}/photos/${photo.id}`,
      canDelete: membership.owner_id === auth.user.id || photo.uploader_id === auth.user.id,
    })),
  });
}

export async function onRequestPost({ request, env, params }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;

  const membership = await getAlbumMembership(env, params.id, auth.user.id);
  if (!membership) {
    return Response.json({ error: "Album not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("photo");

  if (!file || !file.type?.startsWith("image/")) {
    return Response.json({ error: "Choose an image" }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return Response.json({ error: "Image must be less than 8 MB" }, { status: 413 });
  }

  const id = crypto.randomUUID();
  const r2Key = `albums/${params.id}/photos/${id}-${file.name}`;
  const createdAt = new Date().toISOString();

  await env.PHOTOS_BUCKET.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  await env.DB.prepare(
    `INSERT INTO album_photos
     (id, album_id, uploader_id, uploader_email, filename, content_type, r2_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      params.id,
      auth.user.id,
      auth.user.email || "",
      file.name,
      file.type,
      r2Key,
      createdAt
    )
    .run();

  return Response.json({ success: true }, { status: 201 });
}
