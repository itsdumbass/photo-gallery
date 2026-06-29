export async function onRequestGet({ params, env }) {
  const photo = await env.DB.prepare(
    "SELECT * FROM photos WHERE id = ?"
  )
    .bind(params.id)
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
      "Cache-Control": "public, max-age=31536000",
    },
  });
}

export async function onRequestDelete({ params, env }) {
  const photo = await env.DB.prepare(
    "SELECT * FROM photos WHERE id = ?"
  )
    .bind(params.id)
    .first();

  if (!photo) {
    return Response.json({ error: "Photo not found" }, { status: 404 });
  }

  await env.PHOTOS_BUCKET.delete(photo.r2_key);

  await env.DB.prepare("DELETE FROM photos WHERE id = ?")
    .bind(params.id)
    .run();

  return Response.json({ success: true });
}