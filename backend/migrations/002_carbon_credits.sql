-- ============================================================
-- Carbon Credit Accounting Schema Migration
-- Run this after your existing users and trees tables exist
-- ============================================================

-- ============================================================
-- 1. Add carbon estimation field to trees table if not exists
-- ============================================================
ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS carbon_absorption_kg_per_year NUMERIC(10,2) DEFAULT 0;

-- Update existing trees to extract absorption from metadata JSON
UPDATE trees 
SET carbon_absorption_kg_per_year = COALESCE((metadata->>'absorptionKgPerYear')::NUMERIC, 0)
WHERE carbon_absorption_kg_per_year = 0 OR carbon_absorption_kg_per_year IS NULL;

-- ============================================================
-- 2. Carbon Credits Table
-- Tracks credit balances and acts as the source of truth
-- for off-chain credit accounting (mirrors on-chain state)
-- ============================================================
CREATE TABLE IF NOT EXISTS carbon_credits (
    id SERIAL PRIMARY KEY,
    
    -- Owner of these credits (references users table)
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Wallet address that owns credits on-chain (nullable if not linked)
    wallet_address VARCHAR(42),
    
    -- Current balance of available credits (kg CO2)
    available_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Total credits ever issued to this user
    total_issued NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Total credits retired (burned) by this user
    total_retired NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Total credits transferred out by this user
    total_transferred_out NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Total credits received via transfer
    total_transferred_in NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_credits UNIQUE(user_id),
    CONSTRAINT positive_balance CHECK (available_balance >= 0)
);

-- ============================================================
-- 3. Credit Issuance Records
-- Tracks each credit issuance event for audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_issuances (
    id SERIAL PRIMARY KEY,
    
    -- User who received the credits
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Tree that generated these credits
    tree_id INTEGER NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    
    -- On-chain tree ID (if registered on blockchain)
    chain_tree_id INTEGER,
    
    -- Amount of credits issued (kg CO2)
    amount NUMERIC(15,2) NOT NULL,
    
    -- Blockchain transaction hash (if issued on-chain)
    tx_hash VARCHAR(66),
    
    -- On-chain issuance ID from contract event
    chain_issuance_id INTEGER,
    
    -- Period this issuance covers
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Issuance metadata
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_issuance CHECK (amount > 0)
);

-- ============================================================
-- 4. Credit Retirements Table
-- Tracks credits that have been retired (burned) for offsetting
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_retirements (
    id SERIAL PRIMARY KEY,
    
    -- User who retired the credits
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Amount of credits retired (kg CO2)
    amount NUMERIC(15,2) NOT NULL,
    
    -- Reason for retirement (e.g., "2024 personal carbon footprint offset")
    reason TEXT NOT NULL,
    
    -- Beneficiary name (who gets credit for the offset)
    beneficiary_name VARCHAR(255),
    
    -- Blockchain transaction hash (if retired on-chain)
    tx_hash VARCHAR(66),
    
    -- On-chain retirement ID from contract event
    chain_retirement_id INTEGER,
    
    -- Certificate number (generated after retirement)
    certificate_number VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_retirement CHECK (amount > 0)
);

-- ============================================================
-- 5. Credit Transfers Table
-- Tracks credit transfers between users
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transfers (
    id SERIAL PRIMARY KEY,
    
    -- Sender user
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Recipient user
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Amount transferred (kg CO2)
    amount NUMERIC(15,2) NOT NULL,
    
    -- Optional note/memo
    memo TEXT,
    
    -- Blockchain transaction hash (if transferred on-chain)
    tx_hash VARCHAR(66),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_transfer CHECK (amount > 0),
    CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

-- ============================================================
-- 6. Indexes for Performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_credit_issuances_user ON credit_issuances(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_issuances_tree ON credit_issuances(tree_id);
CREATE INDEX IF NOT EXISTS idx_credit_retirements_user ON credit_retirements(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transfers_from ON credit_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transfers_to ON credit_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_carbon_credits_wallet ON carbon_credits(wallet_address);

-- ============================================================
-- 7. Helper Function: Update timestamp trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to carbon_credits table
DROP TRIGGER IF EXISTS update_carbon_credits_updated_at ON carbon_credits;
CREATE TRIGGER update_carbon_credits_updated_at
    BEFORE UPDATE ON carbon_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. Initialize carbon_credits records for existing users
-- ============================================================
INSERT INTO carbon_credits (user_id, wallet_address, available_balance)
SELECT id, wallet_address, 0
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM carbon_credits WHERE carbon_credits.user_id = users.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- Done! Run this with: psql -d your_database -f migrations/002_carbon_credits.sql
-- ============================================================
