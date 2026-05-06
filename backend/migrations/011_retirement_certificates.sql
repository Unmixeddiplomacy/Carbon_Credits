-- Migration 011: Support credit retirement certificates

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS credit_retirement_id INTEGER REFERENCES credit_retirements(id);

ALTER TABLE certificates
  DROP CONSTRAINT IF EXISTS valid_cert_type;

ALTER TABLE certificates
  ADD CONSTRAINT valid_cert_type CHECK (
    certificate_type IN (
      'tree_purchase',
      'tree_sale',
      'credit_purchase',
      'credit_sale',
      'credit_retirement'
    )
  );

CREATE INDEX IF NOT EXISTS idx_certificates_credit_retirement
  ON certificates(credit_retirement_id);
