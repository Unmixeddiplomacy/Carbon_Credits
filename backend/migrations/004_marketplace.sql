-- ============================================================
-- Marketplace System Migration
-- Enables tree trading with credit transfer
-- ============================================================

-- ============================================================
-- 1. Add verification tracking to trees
-- ============================================================
ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS verification_required_by DATE;

ALTER TABLE trees 
ADD COLUMN IF NOT EXISTS is_verification_current BOOLEAN DEFAULT false;

-- ============================================================
-- 2. Tree Listings Table
-- Stores trees listed for sale on marketplace
-- ============================================================
CREATE TABLE IF NOT EXISTS tree_listings (
    id SERIAL PRIMARY KEY,
    
    -- Tree being sold
    tree_id INTEGER NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    
    -- Seller (current owner)
    seller_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Asking price in USD (or platform currency)
    price NUMERIC(12, 2) NOT NULL,
    
    -- Listing status
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
    
    -- Optional description/notes
    description TEXT,
    
    -- Listing expiration (optional)
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sold_at TIMESTAMP WITH TIME ZONE,
    
    -- Only one active listing per tree
    CONSTRAINT unique_active_listing UNIQUE (tree_id, status) 
        DEFERRABLE INITIALLY DEFERRED,
    
    -- Price must be positive
    CONSTRAINT positive_price CHECK (price > 0)
);

-- ============================================================
-- 3. Tree Transactions Table
-- Records completed tree sales
-- ============================================================
CREATE TABLE IF NOT EXISTS tree_transactions (
    id SERIAL PRIMARY KEY,
    
    -- The listing that was purchased
    listing_id INTEGER NOT NULL REFERENCES tree_listings(id),
    
    -- Tree involved
    tree_id INTEGER NOT NULL REFERENCES trees(id),
    
    -- Seller and buyer
    seller_user_id INTEGER NOT NULL REFERENCES users(id),
    buyer_user_id INTEGER NOT NULL REFERENCES users(id),
    
    -- Final sale price
    sale_price NUMERIC(12, 2) NOT NULL,
    
    -- Credits transferred with tree (snapshot at time of sale)
    credits_transferred NUMERIC(15, 4) NOT NULL DEFAULT 0,
    
    -- Transaction status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    
    -- Blockchain transaction hash (if on-chain)
    tx_hash VARCHAR(66),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Notes
    notes TEXT
);

-- ============================================================
-- 4. Credit Transfers Table (for marketplace transfers)
-- Records credit movements during tree sales
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transfers (
    id SERIAL PRIMARY KEY,
    
    -- Related transaction
    transaction_id INTEGER REFERENCES tree_transactions(id),
    
    -- Tree that generated these credits
    tree_id INTEGER REFERENCES trees(id),
    
    -- From/To users
    from_user_id INTEGER NOT NULL REFERENCES users(id),
    to_user_id INTEGER NOT NULL REFERENCES users(id),
    
    -- Amount transferred
    amount NUMERIC(15, 4) NOT NULL,
    
    -- Transfer type
    transfer_type VARCHAR(30) NOT NULL DEFAULT 'tree_sale'
        CHECK (transfer_type IN ('tree_sale', 'manual', 'gift', 'correction')),
    
    -- Blockchain transaction hash
    tx_hash VARCHAR(66),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_transfer CHECK (amount > 0)
);

-- ============================================================
-- 5. Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tree_listings_status ON tree_listings(status);
CREATE INDEX IF NOT EXISTS idx_tree_listings_seller ON tree_listings(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_tree_listings_tree ON tree_listings(tree_id);
CREATE INDEX IF NOT EXISTS idx_tree_transactions_buyer ON tree_transactions(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_tree_transactions_seller ON tree_transactions(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transfers_from ON credit_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transfers_to ON credit_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_trees_last_verified ON trees(last_verified_at);
CREATE INDEX IF NOT EXISTS idx_trees_verification_required ON trees(verification_required_by);

-- ============================================================
-- 6. Update existing verifications to set last_verified_at
-- ============================================================
UPDATE trees t
SET last_verified_at = (
    SELECT MAX(v.created_at) 
    FROM tree_verifications v 
    WHERE v.tree_id = t.id AND v.status = 'approved'
)
WHERE t.status = 'active';

-- Set verification_required_by for active trees (2 days from last verification)
UPDATE trees t
SET verification_required_by = (
    COALESCE(t.last_verified_at, t.registered_at)::DATE + INTERVAL '2 days'
)::DATE
WHERE t.status = 'active';

-- Mark verification status
UPDATE trees
SET is_verification_current = (verification_required_by >= CURRENT_DATE)
WHERE status = 'active';
