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
      name VARCHAR(50) NOT NULL,
      type VARCHAR(10) NOT NULL DEFAULT 'text',
      created_by INT REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id            SERIAL PRIMARY KEY,
      channel_id    VARCHAR(100) NOT NULL,
      channel_db_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
      user_id       INT REFERENCES users(id),
      username      VARCHAR(50),
      content       TEXT NOT NULL,
      reply_to_id   INT REFERENCES messages(id) ON DELETE SET NULL,
      edited_at     TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reactions (
      id SERIAL PRIMARY KEY,
      message_id INT REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
      user_id INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      emoji VARCHAR(10) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(message_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id             SERIAL PRIMARY KEY,
      admin_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_username VARCHAR(50) NOT NULL,
      action         VARCHAR(50) NOT NULL,
      target_type    VARCHAR(20),
      target_id      INTEGER,
      target_name    VARCHAR(200),
      metadata       JSONB,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_audit_log(created_at DESC);

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

    CREATE INDEX IF NOT EXISTS idx_messages_channel_db_id ON messages(channel_db_id, id DESC);
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
  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS kicked_until TIMESTAMPTZ NULL`,
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
      user_id     INT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      channel_id  INTEGER REFERENCES channels(id) ON DELETE CASCADE NOT NULL,
      last_read_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, channel_id)
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_channel_last_read ON channel_last_read(user_id);`,
  );

  await pool.query(
    `ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_afk BOOLEAN DEFAULT FALSE`,
  );
  await pool.query(
    `UPDATE channels SET is_afk = TRUE WHERE name = 'voice-afk'`,
  );

  // Communities
  await pool.query(`
  CREATE TABLE IF NOT EXISTS communities (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    icon         TEXT,
    banner       TEXT,
    owner_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_public    BOOLEAN DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  );
`);

  await pool.query(`
  CREATE TABLE IF NOT EXISTS community_roles (
    id           SERIAL PRIMARY KEY,
    community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
    name         VARCHAR(50) NOT NULL,
    color        VARCHAR(7) DEFAULT '#99aab5',
    position     INTEGER DEFAULT 0,
    is_default   BOOLEAN DEFAULT false,
    permissions  JSONB DEFAULT '{"view_channel":true,"send_messages":true,"manage_messages":false,"kick_members":false,"ban_members":false,"manage_channels":false,"manage_community":false,"join_voice":true,"mute_members":false}'
  );
`);

  await pool.query(`
  CREATE TABLE IF NOT EXISTS community_members (
    id           SERIAL PRIMARY KEY,
    community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
    user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
    nickname     VARCHAR(50),
    joined_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_id, user_id)
  );
`);

  await pool.query(`
  CREATE TABLE IF NOT EXISTS member_roles (
    member_id INTEGER REFERENCES community_members(id) ON DELETE CASCADE,
    role_id   INTEGER REFERENCES community_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (member_id, role_id)
  );
`);

  await pool.query(`
  CREATE TABLE IF NOT EXISTS categories (
    id           SERIAL PRIMARY KEY,
    community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    position     INTEGER DEFAULT 0
  );
`);

  await pool.query(`
  ALTER TABLE channels
    ADD COLUMN IF NOT EXISTS community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS position     INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS topic        TEXT,
    ADD COLUMN IF NOT EXISTS is_private   BOOLEAN DEFAULT false;
`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS channel_role_access (
      channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
      role_id    INTEGER REFERENCES community_roles(id) ON DELETE CASCADE,
      PRIMARY KEY (channel_id, role_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_invites (
      id           SERIAL PRIMARY KEY,
      community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
      code         VARCHAR(20) UNIQUE NOT NULL,
      created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      max_uses     INTEGER DEFAULT NULL,
      uses         INTEGER DEFAULT 0,
      expires_at   TIMESTAMPTZ DEFAULT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Set is_afk on voice-afk
  await pool.query(`
    UPDATE channels SET is_afk = TRUE WHERE name = 'voice-afk' AND is_afk = FALSE;
  `);

  console.log("DB tables ready");
}

export default pool;
