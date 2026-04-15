-- Migration 008: Add on-chain NFT fields to certificates table
-- Stores tokenId, transaction hash, and blockchain network from the CertificateNFT ERC-721 contract

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS token_id        INTEGER,
  ADD COLUMN IF NOT EXISTS tx_hash         VARCHAR(128),
  ADD COLUMN IF NOT EXISTS block_number    BIGINT,
  ADD COLUMN IF NOT EXISTS chain_id        INTEGER,
  ADD COLUMN IF NOT EXISTS contract_address VARCHAR(64),
  ADD COLUMN IF NOT EXISTS mint_status     VARCHAR(20) NOT NULL DEFAULT 'pending';

-- mint_status: 'pending' | 'minted' | 'failed'
-- pending  = DB cert created, on-chain mint not attempted yet or in progress
-- minted   = successfully minted on-chain
-- failed   = on-chain mint failed (will retry)

COMMENT ON COLUMN certificates.token_id         IS 'ERC-721 tokenId from CertificateNFT contract';
COMMENT ON COLUMN certificates.tx_hash          IS 'On-chain transaction hash of the mint';
COMMENT ON COLUMN certificates.block_number     IS 'Block number the mint was included in';
COMMENT ON COLUMN certificates.chain_id         IS 'Chain ID (e.g. 11155111 for Sepolia)';
COMMENT ON COLUMN certificates.contract_address IS 'CertificateNFT contract address used';
COMMENT ON COLUMN certificates.mint_status      IS 'pending | minted | failed';

CREATE INDEX IF NOT EXISTS idx_certificates_token_id     ON certificates(token_id);
CREATE INDEX IF NOT EXISTS idx_certificates_tx_hash      ON certificates(tx_hash);
CREATE INDEX IF NOT EXISTS idx_certificates_mint_status  ON certificates(mint_status);
