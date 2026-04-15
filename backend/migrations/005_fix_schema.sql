-- ============================================================
-- Schema Fix Migration
-- Ensures all required columns exist for marketplace
-- ============================================================

-- ============================================================
-- 1. Add username column to users (uses name as alias/fallback)
-- ============================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'username') THEN
        ALTER TABLE users ADD COLUMN username VARCHAR(100);
        -- Populate username from name for existing users
        UPDATE users SET username = name WHERE username IS NULL;
    END IF;
END $$;

-- ============================================================
-- 2. Ensure trees table has all required columns
-- ============================================================

-- Status column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trees' AND column_name = 'status') THEN
        ALTER TABLE trees ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
    END IF;
END $$;

-- Total credits accrued
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trees' AND column_name = 'total_credits_accrued') THEN
        ALTER TABLE trees ADD COLUMN total_credits_accrued NUMERIC(15, 4) DEFAULT 0;
    END IF;
END $$;

-- Carbon absorption rate
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trees' AND column_name = 'carbon_absorption_kg_per_year') THEN
        ALTER TABLE trees ADD COLUMN carbon_absorption_kg_per_year NUMERIC(10, 4) DEFAULT 0;
    END IF;
END $$;

-- Updated at for trees
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trees' AND column_name = 'updated_at') THEN
        ALTER TABLE trees ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Owner wallet
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trees' AND column_name = 'owner_wallet') THEN
        ALTER TABLE trees ADD COLUMN owner_wallet VARCHAR(42);
    END IF;
END $$;

-- ============================================================
-- 3. Ensure tree_verifications table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS tree_verifications (
    id SERIAL PRIMARY KEY,
    tree_id INTEGER NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    capture_latitude NUMERIC(10, 7),
    capture_longitude NUMERIC(10, 7),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    verified_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- 4. Ensure tree_listings table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS tree_listings (
    id SERIAL PRIMARY KEY,
    tree_id INTEGER NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    seller_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    price NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
    description TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sold_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- 5. Ensure tree_transactions table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS tree_transactions (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES tree_listings(id),
    tree_id INTEGER NOT NULL REFERENCES trees(id),
    seller_user_id INTEGER NOT NULL REFERENCES users(id),
    buyer_user_id INTEGER NOT NULL REFERENCES users(id),
    sale_price NUMERIC(12, 2) NOT NULL,
    credits_transferred NUMERIC(15, 4) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 6. Ensure credit_transfers table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transfers (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES tree_transactions(id),
    tree_id INTEGER REFERENCES trees(id),
    from_user_id INTEGER REFERENCES users(id),
    to_user_id INTEGER REFERENCES users(id),
    amount NUMERIC(15, 4) NOT NULL,
    transfer_type VARCHAR(30) DEFAULT 'tree_sale',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 7. Create indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tree_listings_status ON tree_listings(status);
CREATE INDEX IF NOT EXISTS idx_tree_listings_tree_id ON tree_listings(tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_listings_seller ON tree_listings(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_tree_verifications_tree ON tree_verifications(tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_verifications_status ON tree_verifications(status);
CREATE INDEX IF NOT EXISTS idx_tree_transactions_buyer ON tree_transactions(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_tree_transactions_seller ON tree_transactions(seller_user_id);

-- ============================================================
-- 8. Ensure carbon_credits table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS carbon_credits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    available_balance NUMERIC(15, 4) DEFAULT 0,
    total_issued NUMERIC(15, 4) DEFAULT 0,
    total_retired NUMERIC(15, 4) DEFAULT 0,
    total_transferred_in NUMERIC(15, 4) DEFAULT 0,
    total_transferred_out NUMERIC(15, 4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 9. Ensure credit_issuances table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_issuances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tree_id INTEGER NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    chain_tree_id INTEGER,
    amount NUMERIC(15, 4) NOT NULL,
    tx_hash VARCHAR(66),
    chain_issuance_id INTEGER,
    period_start DATE,
    period_end DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 10. Ensure credit_retirements table exists
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_retirements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(15, 4) NOT NULL,
    reason TEXT,
    beneficiary_name VARCHAR(255),
    tx_hash VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 11. Ensure credit_slashes table exists (for dead trees)
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_slashes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tree_id INTEGER NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    amount NUMERIC(15, 4) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Done
-- ============================================================
SELECT 'Migration 005_fix_schema completed successfully' as status;
