/**
 * Reset database for a fresh start
 * 
 * Use this when:
 * - You restart the Hardhat node and re-deploy contracts
 * - You want to clear all trees/credits and start fresh
 * - You switch between localhost and Sepolia networks
 * 
 * This script:
 * 1. Truncates tree-related tables (trees, verifications, credits, etc.)
 * 2. Optionally keeps users (so you don't have to re-register)
 * 
 * Usage:
 *   node scripts/resetForFreshStart.js          # Keep users, reset trees/credits
 *   node scripts/resetForFreshStart.js --all    # Reset everything including users
 */

import dotenv from "dotenv";
dotenv.config();

import pool from "../config/db.js";

const RESET_ALL = process.argv.includes("--all");

async function main() {
  console.log("[Reset] Starting database reset...");
  console.log(`[Reset] Mode: ${RESET_ALL ? "FULL RESET (including users)" : "Trees & Credits only (keeping users)"}`);

  try {
    if (RESET_ALL) {
      // Full reset - everything
      console.log("[Reset] Truncating ALL tables...");
      await pool.query(`
        TRUNCATE TABLE 
          pending_issuances,
          credit_accrual_logs,
          credit_slashes,
          credit_transfers,
          credit_retirements,
          credit_issuances,
          carbon_credits,
          tree_verifications,
          trees,
          users
        RESTART IDENTITY CASCADE
      `);
      console.log("[Reset] All tables truncated.");
    } else {
      // Partial reset - keep users
      console.log("[Reset] Truncating tree and credit tables (keeping users)...");
      
      // First truncate dependent tables
      await pool.query(`
        TRUNCATE TABLE 
          pending_issuances,
          credit_accrual_logs,
          credit_slashes,
          credit_transfers,
          credit_retirements,
          credit_issuances,
          tree_verifications,
          trees
        RESTART IDENTITY CASCADE
      `);

      // Reset carbon_credits balances to 0 instead of deleting
      await pool.query(`
        UPDATE carbon_credits 
        SET available_balance = 0, 
            total_issued = 0, 
            total_retired = 0, 
            total_transferred_in = 0, 
            total_transferred_out = 0,
            updated_at = NOW()
      `);

      // Clear wallet addresses from users (optional - uncomment if you want users to re-link)
      // await pool.query(`UPDATE users SET wallet_address = NULL`);

      console.log("[Reset] Tree and credit tables truncated, user balances zeroed.");
    }

    console.log("\n[Reset] Database reset complete!");
    console.log("\nNext steps:");
    console.log("  1. Deploy contracts (if not already deployed to Sepolia):");
    console.log("     npx hardhat run scripts/deploy.js --network sepolia");
    console.log("  2. Start your backend and frontend");
    console.log("  3. Register trees from the UI (they'll be minted on the current chain)");
    console.log("  4. Run credit accrual: npm run run:accrual");

  } catch (err) {
    console.error("[Reset] Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
