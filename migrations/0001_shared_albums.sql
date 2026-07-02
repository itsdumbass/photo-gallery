CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS album_members (
  album_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (album_id, user_id),
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS album_photos (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL,
  uploader_id TEXT NOT NULL,
  uploader_email TEXT,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_album_members_user
  ON album_members(user_id);

CREATE INDEX IF NOT EXISTS idx_album_photos_album
  ON album_photos(album_id, created_at DESC);
