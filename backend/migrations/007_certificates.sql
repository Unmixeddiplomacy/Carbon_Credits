-- Migration 007: NFT-style certificates for marketplace transactions
-- Each buy/sell generates an immutable certificate as proof of transaction

CREATE TABLE IF NOT EXISTS certificates (
  id              SERIAL PRIMARY KEY,

  -- Unique certificate identifiers
  certificate_number  VARCHAR(64)  NOT NULL UNIQUE,
  certificate_hash    VARCHAR(128) NOT NULL UNIQUE,

  -- Certificate type: tree_purchase, tree_sale, credit_purchase, credit_sale
  certificate_type    VARCHAR(30)  NOT NULL,

  -- Transaction references (one will be set based on type)
  tree_transaction_id   INTEGER REFERENCES tree_transactions(id),
  credit_transaction_id INTEGER REFERENCES credit_transactions(id),

  -- Parties
  issuer_user_id    INTEGER NOT NULL REFERENCES users(id),
  recipient_user_id INTEGER NOT NULL REFERENCES users(id),

  -- Asset details
  asset_type        VARCHAR(20) NOT NULL,  -- 'tree' or 'carbon_credit'
  asset_description TEXT        NOT NULL,

  -- Financial
  amount            NUMERIC(18,4) NOT NULL DEFAULT 0,
  currency          VARCHAR(10)   NOT NULL DEFAULT 'USD',
  credits_amount    NUMERIC(18,4) DEFAULT 0,

  -- Tree-specific (null for credit certificates)
  tree_id           INTEGER REFERENCES trees(id),
  tree_species      VARCHAR(100),
  tree_name         VARCHAR(200),

  -- Metadata
  metadata          JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_cert_type CHECK (
    certificate_type IN ('tree_purchase', 'tree_sale', 'credit_purchase', 'credit_sale')
  ),
  CONSTRAINT valid_asset_type CHECK (
    asset_type IN ('tree', 'carbon_credit')
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_certificates_recipient ON certificates(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_issuer ON certificates(issuer_user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_type ON certificates(certificate_type);
CREATE INDEX IF NOT EXISTS idx_certificates_number ON certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_tree_tx ON certificates(tree_transaction_id);
CREATE INDEX IF NOT EXISTS idx_certificates_credit_tx ON certificates(credit_transaction_id);
CREATE INDEX IF NOT EXISTS idx_certificates_issued_at ON certificates(issued_at DESC);
