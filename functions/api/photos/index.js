import { requireUser } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);

  if (auth.error) {
    return auth.error;
  }

  const { results } = await env.DB.prepare(
    "SELECT id, filename, content_type, created_at, title, tags, favorite FROM photos WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(auth.user.id)
    .all();

  const photos = results.map((photo) => ({
    ...photo,
    imageUrl: `/api/photos/${photo.id}`,
  }));

  return Response.json(photos);
}

export async function onRequestPost({ request, env }) {
  const auth = await requireUser(request, env);

  if (auth.error) {
    return auth.error;
  }

  const formData = await request.formData();
  const file = formData.get("photo");

  if (!file) {
    return Response.json({ error: "No photo uploaded" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const r2Key = `users/${auth.user.id}/photos/${id}-${file.name}`;
  const createdAt = new Date().toISOString();

  await env.PHOTOS_BUCKET.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
    },
  });

  await env.DB.prepare(
    `INSERT INTO photos 
     (id, user_id, filename, content_type, r2_key, created_at, title, tags, favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, auth.user.id, file.name, file.type, r2Key, createdAt, "", "", 0)
    .run();

  return Response.json({ success: true });
}