-- ============================================================
-- Migration 009: Add role to users for admin dashboard access
-- ============================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Optional: if you want to promote an existing account to admin
-- UPDATE users SET role = 'admin' WHERE email = 'admin@gmail.com';
