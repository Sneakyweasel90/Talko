import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      public_key TEXT,
      nickname VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS channels (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      type VARCHAR(10) NOT NULL DEFAULT 'text',
      created_by INT REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      channel_id VARCHAR(100) NOT NULL,
      user_id INT REFERENCES users(id),
      username VARCHAR(50),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reactions (
      id SERIAL PRIMARY KEY,
      message_id INT REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
      user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      emoji VARCHAR(10) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(message_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS server_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT INTO server_settings (key, value) VALUES ('afk_timeout_minutes', '10')
      ON CONFLICT (key) DO NOTHING;

    CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages USING gin(to_tsvector('english', content));
    CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);

    CREATE TABLE IF NOT EXISTS local_nicknames (
      owner_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      target_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      nickname VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (owner_id, target_id)
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
  `);

  // Users table additions
  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS public_key TEXT;`,
  );
  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(50);`,
  );
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;`);
  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';`,
  );
  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_role_name VARCHAR(50);`,
  );
  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;`,
  );

  // DM tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_conversations (
      id SERIAL PRIMARY KEY,
      user1_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      user2_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user1_id, user2_id)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_last_read (
      user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      dm_channel_id VARCHAR(100) NOT NULL,
      last_read_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, dm_channel_id)
    );
  `);

  // Messages table additions
  await pool.query(
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INT REFERENCES messages(id) ON DELETE SET NULL;`,
  );
  await pool.query(
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;`,
  );

  // ── Invite tokens table ──────────────────────────────────────────────────────
  // Replaces the static INVITE_CODE env var with admin-generated single-use tokens.
  // Each token can optionally have an expiry. Once used, used_at is set and it cannot be reused.
  // The static env var INVITE_CODE is still checked as a fallback for bootstrapping
  // (so existing deployments keep working until the admin generates DB tokens).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      id SERIAL PRIMARY KEY,
      token VARCHAR(64) UNIQUE NOT NULL,
      created_by INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      used_at TIMESTAMPTZ,
      used_by_username VARCHAR(50),
      note VARCHAR(100)
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);`,
  );

  await pool.query(`
  CREATE TABLE IF NOT EXISTS pinned_messages (
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    message_id INT REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
    pinned_by INT REFERENCES users(id) ON DELETE SET NULL,
    pinned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_name, message_id)
  );
`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_pinned_messages_channel ON pinned_messages(channel_name);`,
  );

  // Promote the oldest account to admin (safe to re-run)
  await pool.query(`
    UPDATE users SET role = 'admin'
    WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)
    AND role = 'user'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS channel_last_read (
      user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      channel_name VARCHAR(100) NOT NULL,
      last_read_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, channel_name)
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_channel_last_read ON channel_last_read(user_id);`,
  );

  await pool.query(`
    INSERT INTO channels (name, type) VALUES
      ('general', 'text'),
      ('random', 'text'),
      ('yakking', 'text'),
      ('voice-general', 'voice'),
      ('voice-chill', 'voice'),
      ('voice-afk', 'voice')
    ON CONFLICT (name) DO NOTHING;
  `);

  await pool.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_afk BOOLEAN DEFAULT FALSE`);
  await pool.query(`UPDATE channels SET is_afk = TRUE WHERE name = 'voice-afk'`);

  console.log("DB tables ready");
}

export default pool;
