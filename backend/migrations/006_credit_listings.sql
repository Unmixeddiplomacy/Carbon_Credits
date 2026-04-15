-- ============================================================
-- Credit Listings - Marketplace for selling carbon credits
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_listings (
    id SERIAL PRIMARY KEY,

    -- Seller
    seller_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Amount of credits listed for sale (kg CO₂)
    amount NUMERIC(15, 4) NOT NULL,

    -- Price per unit (per kg CO₂)
    price_per_unit NUMERIC(12, 4) NOT NULL,

    -- Total price (amount * price_per_unit, denormalized for queries)
    total_price NUMERIC(15, 4) NOT NULL,

    -- Listing status
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'sold', 'partially_sold', 'cancelled')),

    -- Remaining amount (decreases as portions are bought)
    remaining_amount NUMERIC(15, 4) NOT NULL,

    -- Optional description
    description TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sold_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT positive_credit_amount CHECK (amount > 0),
    CONSTRAINT positive_credit_price CHECK (price_per_unit > 0),
    CONSTRAINT positive_remaining CHECK (remaining_amount >= 0)
);

-- ============================================================
-- Credit Transactions - Records credit marketplace purchases
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,

    -- The listing that was purchased
    listing_id INTEGER NOT NULL REFERENCES credit_listings(id),

    -- Buyer and seller
    seller_user_id INTEGER NOT NULL REFERENCES users(id),
    buyer_user_id INTEGER NOT NULL REFERENCES users(id),

    -- Amount purchased
    amount NUMERIC(15, 4) NOT NULL,

    -- Price paid
    price_per_unit NUMERIC(12, 4) NOT NULL,
    total_price NUMERIC(15, 4) NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'completed'
        CHECK (status IN ('pending', 'completed', 'failed')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT positive_tx_amount CHECK (amount > 0)
);

-- ============================================================
-- Add market_sale to credit_transfers transfer_type constraint
-- ============================================================
ALTER TABLE credit_transfers DROP CONSTRAINT IF EXISTS credit_transfers_transfer_type_check;
ALTER TABLE credit_transfers ADD CONSTRAINT credit_transfers_transfer_type_check
    CHECK (transfer_type IN ('tree_sale', 'manual', 'gift', 'correction', 'market_sale'));

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_credit_listings_status ON credit_listings(status);
CREATE INDEX IF NOT EXISTS idx_credit_listings_seller ON credit_listings(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_buyer ON credit_transactions(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_seller ON credit_transactions(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_listing ON credit_transactions(listing_id);
