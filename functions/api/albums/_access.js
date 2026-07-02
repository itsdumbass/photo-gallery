export async function getAlbumMembership(env, albumId, userId) {
  return env.DB.prepare(
    `SELECT a.id, a.name, a.owner_id, a.invite_code, a.created_at, m.role
     FROM albums a
     INNER JOIN album_members m ON m.album_id = a.id
     WHERE a.id = ? AND m.user_id = ?`
  )
    .bind(albumId, userId)
    .first();
}
