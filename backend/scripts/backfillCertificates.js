/**
 * Backfill NFT-style certificates for previous marketplace transactions.
 *
 * Idempotent: skips any transaction that already has certificates.
 *
 * Usage:
 *   node scripts/backfillCertificates.js
 */

import dotenv from "dotenv";
import pool from "../config/db.js";
import { issueTreeCertificates, issueCreditCertificates } from "../services/certificate.service.js";

dotenv.config();

async function backfillTreeTransactions() {
  const result = await pool.query(
    `SELECT tx.id,
            tx.tree_id,
            tx.seller_user_id,
            tx.buyer_user_id,
            tx.sale_price,
            tx.credits_transferred,
            t.metadata as tree_metadata,
            COALESCE(seller.username, seller.name, seller.email) as seller_username,
            COALESCE(buyer.username, buyer.name, buyer.email) as buyer_username
     FROM tree_transactions tx
     JOIN trees t ON t.id = tx.tree_id
     JOIN users seller ON seller.id = tx.seller_user_id
     JOIN users buyer  ON buyer.id  = tx.buyer_user_id
     WHERE tx.status = 'completed'
     ORDER BY tx.id ASC`
  );

  let created = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const exists = await client.query(
        `SELECT 1
         FROM certificates
         WHERE tree_transaction_id = $1
           AND certificate_type IN ('tree_purchase','tree_sale')
         LIMIT 1`,
        [row.id]
      );

      if (exists.rows.length > 0) {
        skipped++;
        await client.query("ROLLBACK");
        continue;
      }

      await issueTreeCertificates(client, {
        transactionId: row.id,
        treeId: row.tree_id,
        sellerId: row.seller_user_id,
        buyerId: row.buyer_user_id,
        price: row.sale_price,
        creditsTransferred: row.credits_transferred || 0,
        treeMetadata: row.tree_metadata || {},
        sellerUsername: row.seller_username || "Unknown",
        buyerUsername: row.buyer_username || "Unknown",
      });

      await client.query("COMMIT");
      created++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[Backfill] Tree tx ${row.id} failed:`, err);
    } finally {
      client.release();
    }
  }

  return { created, skipped, total: result.rows.length };
}

async function backfillCreditTransactions() {
  const result = await pool.query(
    `SELECT ct.id,
            ct.seller_user_id,
            ct.buyer_user_id,
            ct.amount,
            ct.price_per_unit,
            ct.total_price,
            COALESCE(seller.username, seller.name, seller.email) as seller_username,
            COALESCE(buyer.username, buyer.name, buyer.email) as buyer_username
     FROM credit_transactions ct
     JOIN users seller ON seller.id = ct.seller_user_id
     JOIN users buyer  ON buyer.id  = ct.buyer_user_id
     WHERE ct.status = 'completed'
     ORDER BY ct.id ASC`
  );

  let created = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const exists = await client.query(
        `SELECT 1
         FROM certificates
         WHERE credit_transaction_id = $1
           AND certificate_type IN ('credit_purchase','credit_sale')
         LIMIT 1`,
        [row.id]
      );

      if (exists.rows.length > 0) {
        skipped++;
        await client.query("ROLLBACK");
        continue;
      }

      await issueCreditCertificates(client, {
        creditTransactionId: row.id,
        sellerId: row.seller_user_id,
        buyerId: row.buyer_user_id,
        amount: row.amount,
        pricePerUnit: row.price_per_unit,
        totalPrice: row.total_price,
        sellerUsername: row.seller_username || "Unknown",
        buyerUsername: row.buyer_username || "Unknown",
      });

      await client.query("COMMIT");
      created++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[Backfill] Credit tx ${row.id} failed:`, err);
    } finally {
      client.release();
    }
  }

  return { created, skipped, total: result.rows.length };
}

async function main() {
  console.log("[Backfill] Starting certificate backfill...");

  const treeStats = await backfillTreeTransactions();
  console.log(
    `[Backfill] Tree transactions: created ${treeStats.created}, skipped ${treeStats.skipped}, total ${treeStats.total}`
  );

  const creditStats = await backfillCreditTransactions();
  console.log(
    `[Backfill] Credit transactions: created ${creditStats.created}, skipped ${creditStats.skipped}, total ${creditStats.total}`
  );

  console.log("[Backfill] Done.");
  await pool.end();
}

main().catch(async (err) => {
  console.error("[Backfill] Fatal error:", err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
