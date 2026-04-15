-- ============================================================
-- Verification System Migration
-- Adds tree verification, location tracking, and dead tree handling
-- ============================================================

-- ============================================================
-- 1. Add tree status and location columns
-- ============================================================
ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
    CHECK (status IN ('pending', 'active', 'dead', 'removed'));

ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);

ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

-- When was the tree registered (for age calculation)
ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- When tree was marked as dead (null if alive)
ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS death_reported_at TIMESTAMP WITH TIME ZONE;

-- When death was confirmed (null if alive or pending)
ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS death_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Total credits accrued (calculated daily by cron)
ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS total_credits_accrued NUMERIC(15, 4) DEFAULT 0;

-- Last date credits were accrued up to
ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS credits_accrued_until DATE;

-- ============================================================
-- 2. Tree Verifications Table
-- Stores verification requests with photos and GPS
-- ============================================================
CREATE TABLE IF NOT EXISTS tree_verifications (
    id SERIAL PRIMARY KEY,
    
    -- Tree being verified
    tree_id INTEGER NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    
    -- User who submitted verification
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Verification type
    verification_type VARCHAR(30) NOT NULL 
        CHECK (verification_type IN ('initial', 'periodic', 'death_report', 'dispute')),
    
    -- Status of this verification request
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'needs_review')),
    
    -- Photo evidence (URL to stored image)
    photo_url TEXT NOT NULL,
    
    -- GPS coordinates at time of photo
    capture_latitude NUMERIC(10, 7) NOT NULL,
    capture_longitude NUMERIC(10, 7) NOT NULL,
    
    -- Distance from tree's registered location (meters, calculated)
    distance_from_tree NUMERIC(10, 2),
    
    -- Device metadata for fraud detection
    device_info JSONB,
    
    -- Optional notes from user
    user_notes TEXT,
    
    -- Admin review notes
    review_notes TEXT,
    
    -- Who reviewed (null if auto-approved or pending)
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. Credit Slashes Table
-- Records credits removed due to tree death or fraud
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_slashes (
    id SERIAL PRIMARY KEY,
    
    -- Tree that triggered the slash
    tree_id INTEGER NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    
    -- User whose credits were slashed
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Amount slashed (kg CO2)
    amount NUMERIC(15, 4) NOT NULL,
    
    -- Reason for slash
    reason VARCHAR(100) NOT NULL,
    
    -- Detailed explanation
    explanation TEXT,
    
    -- Blockchain transaction hash (from slashCredits call)
    tx_hash VARCHAR(66),
    
    -- Batch ID used in contract call
    batch_id VARCHAR(66),
    
    -- Related verification that triggered this (if any)
    verification_id INTEGER REFERENCES tree_verifications(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. Cron Job Logs Table
-- Track daily credit accrual runs for debugging
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_accrual_logs (
    id SERIAL PRIMARY KEY,
    
    -- When the job ran
    run_date DATE NOT NULL,
    
    -- Job status
    status VARCHAR(20) NOT NULL 
        CHECK (status IN ('started', 'completed', 'failed', 'partial')),
    
    -- Stats
    trees_processed INTEGER DEFAULT 0,
    credits_accrued NUMERIC(15, 4) DEFAULT 0,
    credits_issued NUMERIC(15, 4) DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    
    -- Batch ID for this run (links to blockchain events)
    batch_id VARCHAR(66),
    
    -- Error details if failed
    error_message TEXT,
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_run_date UNIQUE(run_date)
);

-- ============================================================
-- 5. Pending Issuance Queue
-- Credits calculated but not yet minted on-chain
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_issuances (
    id SERIAL PRIMARY KEY,
    
    -- Batch ID for grouping
    batch_id VARCHAR(66) NOT NULL,
    
    tree_id INTEGER NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Amount to issue (kg CO2)
    amount NUMERIC(15, 4) NOT NULL,
    
    -- Period this issuance covers
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'issued', 'failed')),
    
    -- Result
    tx_hash VARCHAR(66),
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- 6. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_trees_status ON trees(status);
CREATE INDEX IF NOT EXISTS idx_trees_user_status ON trees(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trees_accrued_until ON trees(credits_accrued_until);

CREATE INDEX IF NOT EXISTS idx_verifications_tree ON tree_verifications(tree_id);
CREATE INDEX IF NOT EXISTS idx_verifications_user ON tree_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON tree_verifications(status);
CREATE INDEX IF NOT EXISTS idx_verifications_type ON tree_verifications(verification_type);

CREATE INDEX IF NOT EXISTS idx_slashes_tree ON credit_slashes(tree_id);
CREATE INDEX IF NOT EXISTS idx_slashes_user ON credit_slashes(user_id);

CREATE INDEX IF NOT EXISTS idx_pending_issuances_batch ON pending_issuances(batch_id);
CREATE INDEX IF NOT EXISTS idx_pending_issuances_status ON pending_issuances(status);

-- ============================================================
-- 7. Apply update trigger to new tables
-- ============================================================
DROP TRIGGER IF EXISTS update_tree_verifications_updated_at ON tree_verifications;
CREATE TRIGGER update_tree_verifications_updated_at
    BEFORE UPDATE ON tree_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. Update existing trees to have registered_at from created_at
-- ============================================================
UPDATE trees 
SET registered_at = created_at
WHERE registered_at IS NULL;

-- ============================================================
-- Done! Run with: psql -d your_database -f migrations/003_verification_system.sql
-- ============================================================
