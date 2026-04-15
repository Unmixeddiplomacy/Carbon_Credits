/**
 * Certificate Service
 *
 * Generates production-grade NFT-style certificates for marketplace transactions.
 * Each certificate gets a unique number and a SHA-256 integrity hash derived
 * from all its core fields — making it tamper-evident.
 */

import crypto from "crypto";
import pool from "../config/db.js";

// ── Certificate number prefixes ──────────────────────────
const CERT_PREFIXES = {
  tree_purchase: "CC-TP",
  tree_sale: "CC-TS",
  credit_purchase: "CC-CP",
  credit_sale: "CC-CS",
};

/**
 * Generate a unique certificate number.
 * Format: PREFIX-YYYYMMDD-RANDOMHEX  (e.g. CC-TP-20260311-a4f8c2)
 */
function generateCertificateNumber(type) {
  const prefix = CERT_PREFIXES[type] || "CC-XX";
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const rand = crypto.randomBytes(4).toString("hex");
  return `${prefix}-${date}-${rand}`;
}

/**
 * Compute a SHA-256 integrity hash over the certificate's immutable fields.
 */
function computeCertificateHash(fields) {
  const payload = JSON.stringify(fields, Object.keys(fields).sort());
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ── Public API ───────────────────────────────────────────

/**
 * Issue a TREE transaction certificate (purchase or sale).
 *
 * @param {import("pg").PoolClient} client  – active transaction client
 * @param {object} opts
 *   - transactionId       tree_transactions.id
 *   - treeId
 *   - sellerId
 *   - buyerId
 *   - price               sale price (numeric)
 *   - creditsTransferred   kg CO₂ transferred
 *   - treeMetadata         { name, species, plantedAt, … }
 *   - sellerUsername
 *   - buyerUsername
 */
export async function issueTreeCertificates(client, opts) {
  const {
    transactionId,
    treeId,
    sellerId,
    buyerId,
    price,
    creditsTransferred,
    treeMetadata,
    sellerUsername,
    buyerUsername,
  } = opts;

  const treeName = treeMetadata?.name || `Tree #${treeId}`;
  const treeSpecies = treeMetadata?.species || "Unknown";
  const now = new Date().toISOString();

  // ── buyer certificate (purchase) ───────────────────────
  const buyerCertNum = generateCertificateNumber("tree_purchase");
  const buyerFields = {
    certificateNumber: buyerCertNum,
    type: "tree_purchase",
    transactionId,
    treeId,
    buyer: buyerId,
    seller: sellerId,
    price: parseFloat(price),
    creditsTransferred: parseFloat(creditsTransferred),
    issuedAt: now,
  };
  const buyerHash = computeCertificateHash(buyerFields);

  const buyerMeta = {
    treeName,
    treeSpecies,
    plantedAt: treeMetadata?.plantedAt || null,
    sellerUsername,
    buyerUsername,
    creditsTransferred: parseFloat(creditsTransferred),
    network: "CarbonCredit Platform",
    version: "1.0",
  };

  const buyerInsert = await client.query(
    `INSERT INTO certificates
       (certificate_number, certificate_hash, certificate_type,
        tree_transaction_id, issuer_user_id, recipient_user_id,
        asset_type, asset_description, amount, credits_amount,
        tree_id, tree_species, tree_name, metadata, issued_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
     RETURNING id`,
    [
      buyerCertNum,
      buyerHash,
      "tree_purchase",
      transactionId,
      sellerId,   // issuer = the seller
      buyerId,    // recipient = the buyer
      "tree",
      `Purchase of ${treeName} (${treeSpecies})`,
      parseFloat(price),
      parseFloat(creditsTransferred),
      treeId,
      treeSpecies,
      treeName,
      JSON.stringify(buyerMeta),
    ]
  );
  const buyerCertId = buyerInsert.rows[0].id;

  // ── seller certificate (sale) ──────────────────────────
  const sellerCertNum = generateCertificateNumber("tree_sale");
  const sellerFields = {
    certificateNumber: sellerCertNum,
    type: "tree_sale",
    transactionId,
    treeId,
    buyer: buyerId,
    seller: sellerId,
    price: parseFloat(price),
    creditsTransferred: parseFloat(creditsTransferred),
    issuedAt: now,
  };
  const sellerHash = computeCertificateHash(sellerFields);

  const sellerMeta = {
    treeName,
    treeSpecies,
    plantedAt: treeMetadata?.plantedAt || null,
    sellerUsername,
    buyerUsername,
    creditsTransferred: parseFloat(creditsTransferred),
    network: "CarbonCredit Platform",
    version: "1.0",
  };

  const sellerInsert = await client.query(
    `INSERT INTO certificates
       (certificate_number, certificate_hash, certificate_type,
        tree_transaction_id, issuer_user_id, recipient_user_id,
        asset_type, asset_description, amount, credits_amount,
        tree_id, tree_species, tree_name, metadata, issued_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
     RETURNING id`,
    [
      sellerCertNum,
      sellerHash,
      "tree_sale",
      transactionId,
      buyerId,    // issuer = the buyer (counterparty)
      sellerId,   // recipient = the seller
      "tree",
      `Sale of ${treeName} (${treeSpecies})`,
      parseFloat(price),
      parseFloat(creditsTransferred),
      treeId,
      treeSpecies,
      treeName,
      JSON.stringify(sellerMeta),
    ]
  );
  const sellerCertId = sellerInsert.rows[0].id;

  return {
    buyerCertificateNumber: buyerCertNum,
    sellerCertificateNumber: sellerCertNum,
    buyerCertId,
    sellerCertId,
    buyerHash,
    sellerHash,
  };
}

/**
 * Issue CREDIT transaction certificates (purchase and sale).
 *
 * @param {import("pg").PoolClient} client
 * @param {object} opts
 *   - creditTransactionId  credit_transactions.id
 *   - sellerId
 *   - buyerId
 *   - amount               kg CO₂
 *   - pricePerUnit
 *   - totalPrice
 *   - sellerUsername
 *   - buyerUsername
 */
export async function issueCreditCertificates(client, opts) {
  const {
    creditTransactionId,
    sellerId,
    buyerId,
    amount,
    pricePerUnit,
    totalPrice,
    sellerUsername,
    buyerUsername,
  } = opts;

  const now = new Date().toISOString();

  // ── buyer certificate ──────────────────────────────────
  const buyerCertNum = generateCertificateNumber("credit_purchase");
  const buyerHash = computeCertificateHash({
    certificateNumber: buyerCertNum,
    type: "credit_purchase",
    creditTransactionId,
    buyer: buyerId,
    seller: sellerId,
    amount: parseFloat(amount),
    totalPrice: parseFloat(totalPrice),
    issuedAt: now,
  });

  const buyerMeta = {
    pricePerUnit: parseFloat(pricePerUnit),
    sellerUsername,
    buyerUsername,
    network: "CarbonCredit Platform",
    version: "1.0",
  };

  const buyerInsert = await client.query(
    `INSERT INTO certificates
       (certificate_number, certificate_hash, certificate_type,
        credit_transaction_id, issuer_user_id, recipient_user_id,
        asset_type, asset_description, amount, currency, credits_amount,
        metadata, issued_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     RETURNING id`,
    [
      buyerCertNum,
      buyerHash,
      "credit_purchase",
      creditTransactionId,
      sellerId,
      buyerId,
      "carbon_credit",
      `Purchase of ${parseFloat(amount).toFixed(2)} kg CO₂ carbon credits`,
      parseFloat(totalPrice),
      "USD",
      parseFloat(amount),
      JSON.stringify(buyerMeta),
    ]
  );
  const buyerCertId = buyerInsert.rows[0].id;

  // ── seller certificate ─────────────────────────────────
  const sellerCertNum = generateCertificateNumber("credit_sale");
  const sellerHash = computeCertificateHash({
    certificateNumber: sellerCertNum,
    type: "credit_sale",
    creditTransactionId,
    buyer: buyerId,
    seller: sellerId,
    amount: parseFloat(amount),
    totalPrice: parseFloat(totalPrice),
    issuedAt: now,
  });

  const sellerMeta = {
    pricePerUnit: parseFloat(pricePerUnit),
    sellerUsername,
    buyerUsername,
    network: "CarbonCredit Platform",
    version: "1.0",
  };

  const sellerInsert = await client.query(
    `INSERT INTO certificates
       (certificate_number, certificate_hash, certificate_type,
        credit_transaction_id, issuer_user_id, recipient_user_id,
        asset_type, asset_description, amount, currency, credits_amount,
        metadata, issued_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     RETURNING id`,
    [
      sellerCertNum,
      sellerHash,
      "credit_sale",
      creditTransactionId,
      buyerId,
      sellerId,
      "carbon_credit",
      `Sale of ${parseFloat(amount).toFixed(2)} kg CO₂ carbon credits`,
      parseFloat(totalPrice),
      "USD",
      parseFloat(amount),
      JSON.stringify(sellerMeta),
    ]
  );
  const sellerCertId = sellerInsert.rows[0].id;

  return {
    buyerCertificateNumber: buyerCertNum,
    sellerCertificateNumber: sellerCertNum,
    buyerCertId,
    sellerCertId,
    buyerHash,
    sellerHash,
  };
}

/**
 * Get a single certificate by its number (for the authenticated user).
 */
export async function getCertificateByNumber(certificateNumber, userId) {
  const result = await pool.query(
    `SELECT c.*,
            COALESCE(issuer.username, issuer.name, issuer.email)    AS issuer_username,
            COALESCE(recipient.username, recipient.name, recipient.email) AS recipient_username
     FROM certificates c
     JOIN users issuer    ON issuer.id    = c.issuer_user_id
     JOIN users recipient ON recipient.id = c.recipient_user_id
     WHERE c.certificate_number = $1
       AND (c.recipient_user_id = $2 OR c.issuer_user_id = $2)`,
    [certificateNumber, userId]
  );
  return result.rows[0] || null;
}

/**
 * Get all certificates for an authenticated user.
 */
export async function getUserCertificates(userId, { limit = 50, offset = 0 } = {}) {
  const result = await pool.query(
    `SELECT c.*,
            COALESCE(issuer.username, issuer.name, issuer.email)    AS issuer_username,
            COALESCE(recipient.username, recipient.name, recipient.email) AS recipient_username
     FROM certificates c
     JOIN users issuer    ON issuer.id    = c.issuer_user_id
     JOIN users recipient ON recipient.id = c.recipient_user_id
     WHERE c.recipient_user_id = $1 OR c.issuer_user_id = $1
     ORDER BY c.issued_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM certificates
     WHERE recipient_user_id = $1 OR issuer_user_id = $1`,
    [userId]
  );

  return {
    certificates: result.rows,
    total: parseInt(countResult.rows[0]?.total) || 0,
  };
}

/**
 * Format a raw DB certificate row into a clean API response object.
 */
export function formatCertificate(row) {
  const meta = row.metadata || {};
  return {
    id: row.id,
    certificateNumber: row.certificate_number,
    certificateHash: row.certificate_hash,
    type: row.certificate_type,
    assetType: row.asset_type,
    assetDescription: row.asset_description,
    amount: parseFloat(row.amount),
    currency: row.currency,
    creditsAmount: parseFloat(row.credits_amount) || 0,
    treeId: row.tree_id,
    treeName: row.tree_name,
    treeSpecies: row.tree_species,
    issuer: {
      id: row.issuer_user_id,
      username: row.issuer_username,
    },
    recipient: {
      id: row.recipient_user_id,
      username: row.recipient_username,
    },
    metadata: meta,
    issuedAt: row.issued_at,
    createdAt: row.created_at,

    // Convenience fields from metadata
    plantedAt: meta.plantedAt || null,
    network: meta.network || "CarbonCredit Platform",
    version: meta.version || "1.0",
    pricePerUnit: meta.pricePerUnit || null,

    // On-chain fields
    tokenId: row.token_id || null,
    txHash: row.tx_hash || null,
    blockNumber: row.block_number || null,
    chainId: row.chain_id || null,
    contractAddress: row.contract_address || null,
    mintStatus: row.mint_status || "pending",
  };
}
