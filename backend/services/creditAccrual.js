/**
 * Simple Credit Reconciliation Service
 *
 * USER REQUIREMENT:
 * - Ignore periodic verification rules for accrual.
 * - Only require verification once (initial activation).
 * - Credits are based on days since planted (metadata.plantedAt) and absorption rate.
 * - When the backend starts (or on a schedule), reconcile each tree to be up-to-date.
 *
 * DESIGN:
 * - DB-only issuance (no blockchain).
 * - Idempotent: uses trees.credits_accrued_until so it only issues the missing delta.
 */

import pool from "../config/db.js";
import cron from "node-cron";
import { syncIssueCreditsOnChain } from "./carbonCreditOnchain.service.js";

const CONFIG = {
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || "0 2 * * *",
  // Scheduler startup run is opt-in because server.js already runs a startup reconcile.
  RUN_ON_START: process.env.ACCRUAL_RUN_ON_START === "true",
  MIN_CREDITS_TO_ISSUE: Number.parseFloat(process.env.MIN_CREDITS_TO_ISSUE || "0.001"),
  DAYS_PER_YEAR: 365,
};

function toIsoDateString(date) {
  return date.toISOString().split("T")[0];
}

function toUtcDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseMaybeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function daysBetweenDateOnly(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  const start = toUtcDateOnly(startDate);
  const end = toUtcDateOnly(endDate);
  return Math.floor((end - start) / oneDay);
}

function getAbsorptionKgPerYear(treeRow) {
  let absorption = Number.parseFloat(treeRow.carbon_absorption_kg_per_year) || 0;
  if (absorption === 0 && treeRow.metadata?.absorptionKgPerYear) {
    absorption = Number.parseFloat(treeRow.metadata.absorptionKgPerYear) || 0;
  }
  return absorption;
}

function getPlantingDate(treeRow) {
  const planted = parseMaybeDate(treeRow.metadata?.plantedAt);
  if (planted) return planted;
  return parseMaybeDate(treeRow.registered_at) || new Date();
}

/**
 * Reconcile credits for all trees up to today.
 */
export async function runCreditAccrual() {
  const LOCK_SQL = "SELECT pg_try_advisory_lock(hashtext('credit_reconcile')) AS locked";
  const UNLOCK_SQL = "SELECT pg_advisory_unlock(hashtext('credit_reconcile'))";

  const now = new Date();
  const today = toUtcDateOnly(now);
  const runDateStr = toIsoDateString(today);

  console.log(`[Credits] Starting reconciliation for ${runDateStr}`);

  let hasLock = false;
  try {
    const lock = await pool.query(LOCK_SQL);
    hasLock = Boolean(lock.rows[0]?.locked);
    if (!hasLock) {
      console.log("[Credits] Another reconciliation is already running, skipping.");
      return;
    }
  } catch (err) {
    console.error("[Credits] Failed to acquire advisory lock:", err);
    return;
  }

  let logId = null;
  try {
    const logResult = await pool.query(
      `INSERT INTO credit_accrual_logs (run_date, status, started_at)
       VALUES ($1, 'started', NOW())
       ON CONFLICT (run_date) DO UPDATE SET status = 'started', started_at = NOW()
       RETURNING id`,
      [runDateStr]
    );
    logId = logResult.rows[0]?.id ?? null;
  } catch (err) {
    console.error("[Credits] Failed to create log:", err);
  }

  const stats = {
    treesProcessed: 0,
    creditsIssued: 0,
    errorsCount: 0,
  };

  try {
    const { rows: trees } = await pool.query(
      `SELECT
        t.id,
        t.owner_user_id as user_id,
        t.chain_tree_id,
        t.carbon_absorption_kg_per_year,
        t.metadata,
        t.registered_at,
        t.credits_accrued_until,
        t.status,
        t.last_verified_at,
        u.wallet_address as owner_wallet
      FROM trees t
      JOIN users u ON u.id = t.owner_user_id
      WHERE t.status = 'active'
        AND t.owner_user_id IS NOT NULL
        AND t.last_verified_at IS NOT NULL
      ORDER BY t.id`
    );

    for (const tree of trees) {
      try {
        const absorptionKgPerYear = getAbsorptionKgPerYear(tree);
        if (absorptionKgPerYear <= 0) continue;

        const plantingDate = getPlantingDate(tree);
        const accruedUntil = parseMaybeDate(tree.credits_accrued_until) || plantingDate;

        if (toUtcDateOnly(accruedUntil) >= today) continue;

        const daysToIssue = daysBetweenDateOnly(accruedUntil, today);
        if (daysToIssue <= 0) continue;

        const dailyRate = absorptionKgPerYear / CONFIG.DAYS_PER_YEAR;
        const creditsToIssue = dailyRate * daysToIssue;

        if (creditsToIssue < CONFIG.MIN_CREDITS_TO_ISSUE) continue;

        const periodStartStr = toIsoDateString(toUtcDateOnly(accruedUntil));
        const periodEndStr = runDateStr;

        await pool.query("BEGIN");

        await pool.query(
          `INSERT INTO carbon_credits (user_id, available_balance, total_issued)
           VALUES ($1, 0, 0)
           ON CONFLICT (user_id) DO NOTHING`,
          [tree.user_id]
        );

        await pool.query(
          `INSERT INTO credit_issuances
           (user_id, tree_id, amount, period_start, period_end, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            tree.user_id,
            tree.id,
            creditsToIssue,
            periodStartStr,
            periodEndStr,
            `Reconciled credits: ${daysToIssue} days at ${absorptionKgPerYear} kg/year`,
          ]
        );

        await pool.query(
          `UPDATE carbon_credits
           SET available_balance = available_balance + $1,
               total_issued = total_issued + $1,
               updated_at = NOW()
           WHERE user_id = $2`,
          [creditsToIssue, tree.user_id]
        );

        await pool.query(
          `UPDATE trees
           SET credits_accrued_until = $1,
               total_credits_accrued = COALESCE(total_credits_accrued, 0) + $2
           WHERE id = $3`,
          [periodEndStr, creditsToIssue, tree.id]
        );

        await pool.query("COMMIT");

        await syncIssueCreditsOnChain({
          chainTreeId: tree.chain_tree_id,
          recipientWallet: tree.owner_wallet,
          amountKg: creditsToIssue,
          source: "accrual",
          reference: `tree:${tree.id}:run:${runDateStr}`,
        }).catch((err) => {
          console.error("[CarbonCredit] accrual sync failed:", err?.message || err);
        });

        stats.treesProcessed++;
        stats.creditsIssued += creditsToIssue;
      } catch (err) {
        try {
          await pool.query("ROLLBACK");
        } catch {
          // ignore
        }
        console.error(`[Credits] Error reconciling tree ${tree.id}:`, err);
        stats.errorsCount++;
      }
    }

    if (logId) {
      await pool.query(
        `UPDATE credit_accrual_logs
         SET status = $1,
             trees_processed = $2,
             credits_issued = $3,
             errors_count = $4,
             completed_at = NOW()
         WHERE id = $5`,
        [
          stats.errorsCount > 0 ? "partial" : "completed",
          stats.treesProcessed,
          stats.creditsIssued,
          stats.errorsCount,
          logId,
        ]
      );
    }

    console.log(
      `[Credits] Completed: ${stats.treesProcessed} trees, ${stats.creditsIssued.toFixed(4)} credits issued, ${stats.errorsCount} errors`
    );
  } catch (err) {
    console.error("[Credits] Fatal reconciliation error:", err);
    if (logId) {
      try {
        await pool.query(
          `UPDATE credit_accrual_logs
           SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [err.message, logId]
        );
      } catch {
        // ignore
      }
    }
  } finally {
    try {
      await pool.query(UNLOCK_SQL);
    } catch {
      // ignore
    }
  }
}

export function startCronScheduler() {
  console.log(`[Credits] Scheduler starting with pattern: ${CONFIG.CRON_SCHEDULE}`);

  if (CONFIG.RUN_ON_START) {
    setTimeout(() => {
      console.log("[Credits] Startup reconciliation triggered");
      runCreditAccrual().catch((err) => console.error("[Credits] Startup error:", err));
    }, 1000);
  }

  cron.schedule(CONFIG.CRON_SCHEDULE, async () => {
    console.log("[Credits] Scheduled reconciliation triggered");
    await runCreditAccrual();
  });

  console.log("[Credits] Scheduler started");
}

export async function triggerManualAccrual() {
  console.log("[Credits] Manual reconciliation triggered");
  await runCreditAccrual();
}

// Backwards-compat export (no-op now)
async function initialize() {
  return true;
}

export { CONFIG, initialize };
