-- ============================================================
-- Migration 010: Tree registration transaction tracking
-- Stores on-chain registration tx and chain for explorer links
-- ============================================================

ALTER TABLE trees
ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(66);

ALTER TABLE trees
ADD COLUMN IF NOT EXISTS tx_chain_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_trees_tx_hash ON trees(tx_hash);
CREATE INDEX IF NOT EXISTS idx_trees_tx_chain_id ON trees(tx_chain_id);

SELECT 'Migration 010_tree_registration_tracking completed successfully' AS status;
