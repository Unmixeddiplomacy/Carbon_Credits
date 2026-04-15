import bcrypt from "bcryptjs";
import pool from "../config/db.js";

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "123456";
const ADMIN_ROLE = "admin";

async function hasUserColumn(columnName) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = $1
     LIMIT 1`,
    [columnName]
  );
  return rows.length > 0;
}

async function ensureRoleColumn() {
  // Keep this minimal and safe: idempotent ALTER for a single column.
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'"
  );

  // Helpful index for admin lookups.
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)"
  );
}

export async function ensureAdminUser() {
  await ensureRoleColumn();

  const existing = await pool.query(
    "SELECT id, email, role FROM users WHERE email = $1 LIMIT 1",
    [ADMIN_EMAIL]
  );

  if (existing.rows.length > 0) {
    // Ensure role is correct.
    if (existing.rows[0].role !== ADMIN_ROLE) {
      await pool.query("UPDATE users SET role = $1 WHERE id = $2", [
        ADMIN_ROLE,
        existing.rows[0].id,
      ]);
    }
    return { created: false, userId: existing.rows[0].id };
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const hasUsername = await hasUserColumn("username");

  // Insert what we can, depending on schema.
  const inserted = hasUsername
    ? await pool.query(
        `INSERT INTO users (name, email, password, role, username)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ["Admin", ADMIN_EMAIL, hashed, ADMIN_ROLE, "admin"]
      )
    : await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ["Admin", ADMIN_EMAIL, hashed, ADMIN_ROLE]
      );

  return { created: true, userId: inserted.rows[0].id };
}
