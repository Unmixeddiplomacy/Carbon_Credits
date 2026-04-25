import pool from "../config/db.js";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { syncIssueCreditsOnChain } from "../services/carbonCreditOnchain.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load contract ABIs and addresses
const treeRegistryAbiPath = path.join(__dirname, "../deployed/TreeRegistry-abi.json");
const treeRegistryAddressPath = path.join(__dirname, "../deployed/TreeRegistry-address.json");

let carbonCreditAbi = null;
let carbonCreditAddress = null;

// These will be loaded after deployment
const carbonCreditAbiPath = path.join(__dirname, "../deployed/CarbonCredit-abi.json");
const carbonCreditAddressPath = path.join(__dirname, "../deployed/CarbonCredit-address.json");

try {
  if (fs.existsSync(carbonCreditAbiPath) && fs.existsSync(carbonCreditAddressPath)) {
    carbonCreditAbi = JSON.parse(fs.readFileSync(carbonCreditAbiPath, "utf8"));
    carbonCreditAddress = JSON.parse(fs.readFileSync(carbonCreditAddressPath, "utf8")).address;
  }
} catch (e) {
  console.warn("CarbonCredit contract not yet deployed:", e.message);
}

const treeRegistryAbi = JSON.parse(fs.readFileSync(treeRegistryAbiPath, "utf8"));
const { address: TREE_REGISTRY_ADDRESS } = JSON.parse(fs.readFileSync(treeRegistryAddressPath, "utf8"));

const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || "http://127.0.0.1:8545"
);

// ============================================================
// Helper Functions
// ============================================================

/**
 * Ensure user has a carbon_credits record (create if not exists)
 */
async function ensureCreditRecord(userId, walletAddress = null) {
  const { rows } = await pool.query(
    "SELECT id FROM carbon_credits WHERE user_id = $1",
    [userId]
  );
  
  if (rows.length === 0) {
    await pool.query(
      `INSERT INTO carbon_credits (user_id, wallet_address, available_balance) 
       VALUES ($1, $2, 0)`,
      [userId, walletAddress]
    );
  }
}

/**
 * Generate a certificate number for retirement
 */
function generateCertificateNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `CC-${timestamp}-${random}`;
}

/**
 * Format credit record for API response
 */
function formatCreditSummary(row) {
  return {
    userId: row.user_id,
    walletAddress: row.wallet_address,
    availableBalance: parseFloat(row.available_balance) || 0,
    totalIssued: parseFloat(row.total_issued) || 0,
    totalRetired: parseFloat(row.total_retired) || 0,
    totalTransferredOut: parseFloat(row.total_transferred_out) || 0,
    totalTransferredIn: parseFloat(row.total_transferred_in) || 0,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// API Controllers
// ============================================================

/**
 * GET /api/credits
 * Get current user's credit summary and balance
 */
export const getCredits = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    await ensureCreditRecord(userId);

    const { rows } = await pool.query(
      `SELECT * FROM carbon_credits WHERE user_id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({
        credits: {
          userId,
          availableBalance: 0,
          totalIssued: 0,
          totalRetired: 0,
          totalTransferredOut: 0,
          totalTransferredIn: 0,
        },
      });
    }

    return res.json({ credits: formatCreditSummary(rows[0]) });
  } catch (err) {
    console.error("getCredits error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/credits/eligible-trees
 * Get trees eligible for credit issuance (owned by user, with absorption data)
 */
export const getEligibleTrees = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    // Get user's trees with their last issuance info
    const { rows } = await pool.query(
      `SELECT 
        t.id,
        t.chain_tree_id,
        t.metadata,
        t.carbon_absorption_kg_per_year,
        t.owner_wallet,
        (
          SELECT MAX(ci.period_end) 
          FROM credit_issuances ci 
          WHERE ci.tree_id = t.id
        ) as last_issuance_end,
        (
          SELECT SUM(ci.amount) 
          FROM credit_issuances ci 
          WHERE ci.tree_id = t.id
        ) as total_credits_issued
      FROM trees t
      WHERE t.owner_user_id = $1
      ORDER BY t.id DESC`,
      [userId]
    );

    const trees = rows.map((row) => {
      // Calculate absorption rate from metadata or column
      let absorptionKgPerYear = parseFloat(row.carbon_absorption_kg_per_year) || 0;
      if (absorptionKgPerYear === 0 && row.metadata?.absorptionKgPerYear) {
        absorptionKgPerYear = parseFloat(row.metadata.absorptionKgPerYear) || 0;
      }

      // Determine if eligible for issuance
      const lastIssuanceEnd = row.last_issuance_end;
      const now = new Date();
      const oneYearAgo = new Date(now);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Can issue if never issued or last issuance was more than 1 year ago
      const canIssue = 
        !lastIssuanceEnd || 
        new Date(lastIssuanceEnd) <= oneYearAgo;

      // Calculate next eligible date
      let nextEligibleDate = null;
      if (lastIssuanceEnd) {
        const nextDate = new Date(lastIssuanceEnd);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        nextEligibleDate = nextDate.toISOString().split("T")[0];
      }

      return {
        id: row.id,
        chainTreeId: row.chain_tree_id,
        name: row.metadata?.name || `Tree #${row.id}`,
        species: row.metadata?.species || "Unknown",
        absorptionKgPerYear,
        ownerWallet: row.owner_wallet,
        totalCreditsIssued: parseFloat(row.total_credits_issued) || 0,
        lastIssuanceEnd,
        canIssue,
        nextEligibleDate,
        isOnChain: row.chain_tree_id != null,
      };
    });

    return res.json({ trees });
  } catch (err) {
    console.error("getEligibleTrees error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * POST /api/credits/issue
 * Issue carbon credits for a tree
 */
export const issueCredits = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { treeId, txHash } = req.body;
    if (!treeId) {
      return res.status(400).json({ error: "Missing treeId" });
    }

    await client.query("BEGIN");

    // Get tree and verify ownership
    const { rows: treeRows } = await client.query(
      `SELECT t.*, u.wallet_address as user_wallet
       FROM trees t
       JOIN users u ON u.id = t.owner_user_id
       WHERE t.id = $1 AND t.owner_user_id = $2`,
      [treeId, userId]
    );

    if (treeRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Tree not found or not owned by you" });
    }

    const tree = treeRows[0];

    // Get absorption rate
    let absorptionKgPerYear = parseFloat(tree.carbon_absorption_kg_per_year) || 0;
    if (absorptionKgPerYear === 0 && tree.metadata?.absorptionKgPerYear) {
      absorptionKgPerYear = parseFloat(tree.metadata.absorptionKgPerYear) || 0;
    }

    if (absorptionKgPerYear <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        error: "Tree has no absorption rate configured. Update the tree metadata first." 
      });
    }

    // Check if already issued this year
    const { rows: lastIssuance } = await client.query(
      `SELECT period_end FROM credit_issuances 
       WHERE tree_id = $1 
       ORDER BY period_end DESC 
       LIMIT 1`,
      [treeId]
    );

    const now = new Date();
    let periodStart = new Date(now);
    periodStart.setFullYear(periodStart.getFullYear() - 1);

    if (lastIssuance.length > 0) {
      const lastEnd = new Date(lastIssuance[0].period_end);
      const minNextDate = new Date(lastEnd);
      minNextDate.setFullYear(minNextDate.getFullYear() + 1);

      if (now < minNextDate) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Credits already issued for this period. Next eligible date: ${minNextDate.toISOString().split("T")[0]}`,
        });
      }
      periodStart = new Date(lastEnd);
      periodStart.setDate(periodStart.getDate() + 1);
    }

    const periodEnd = now;
    const creditsToIssue = absorptionKgPerYear;

    // Ensure credit record exists
    await ensureCreditRecord(userId, tree.user_wallet);

    // Insert issuance record
    const { rows: issuanceRows } = await client.query(
      `INSERT INTO credit_issuances 
       (user_id, tree_id, chain_tree_id, amount, tx_hash, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        userId,
        treeId,
        tree.chain_tree_id,
        creditsToIssue,
        txHash || null,
        periodStart.toISOString().split("T")[0],
        periodEnd.toISOString().split("T")[0],
      ]
    );

    // Update credit balance
    await client.query(
      `UPDATE carbon_credits 
       SET available_balance = available_balance + $1,
           total_issued = total_issued + $1,
           wallet_address = COALESCE(wallet_address, $3)
       WHERE user_id = $2`,
      [creditsToIssue, userId, tree.user_wallet]
    );

    // Get updated balance
    const { rows: creditRows } = await client.query(
      `SELECT * FROM carbon_credits WHERE user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    if (!txHash) {
      syncIssueCreditsOnChain({
        chainTreeId: tree.chain_tree_id,
        recipientWallet: tree.user_wallet,
        amountKg: creditsToIssue,
        source: "manual_issue",
        reference: `issuance:${issuanceRows[0].id}:tree:${treeId}:user:${userId}`,
      }).catch((err) => {
        console.error("[CarbonCredit] manual issue sync failed:", err?.message || err);
      });
    }

    return res.json({
      success: true,
      issuance: {
        id: issuanceRows[0].id,
        treeId,
        amount: creditsToIssue,
        periodStart: periodStart.toISOString().split("T")[0],
        periodEnd: periodEnd.toISOString().split("T")[0],
        txHash: txHash || null,
      },
      credits: formatCreditSummary(creditRows[0]),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("issueCredits error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

/**
 * POST /api/credits/retire
 * Retire (burn) credits for carbon offset
 */
export const retireCredits = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { amount, reason, beneficiaryName, txHash } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "Reason is required" });
    }

    await client.query("BEGIN");

    // Get current balance
    const { rows: creditRows } = await client.query(
      `SELECT * FROM carbon_credits WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    if (creditRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No credits found" });
    }

    const currentBalance = parseFloat(creditRows[0].available_balance);
    if (currentBalance < amount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Insufficient credits. Available: ${currentBalance} kg CO₂`,
      });
    }

    // Generate certificate number
    const certificateNumber = generateCertificateNumber();

    // Insert retirement record
    const { rows: retirementRows } = await client.query(
      `INSERT INTO credit_retirements 
       (user_id, amount, reason, beneficiary_name, tx_hash, certificate_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [userId, amount, reason.trim(), beneficiaryName || null, txHash || null, certificateNumber]
    );

    // Update credit balance
    await client.query(
      `UPDATE carbon_credits 
       SET available_balance = available_balance - $1,
           total_retired = total_retired + $1
       WHERE user_id = $2`,
      [amount, userId]
    );

    // Get updated balance
    const { rows: updatedCredits } = await client.query(
      `SELECT * FROM carbon_credits WHERE user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      retirement: {
        id: retirementRows[0].id,
        amount,
        reason: reason.trim(),
        beneficiaryName: beneficiaryName || null,
        certificateNumber,
        txHash: txHash || null,
        createdAt: retirementRows[0].created_at,
      },
      credits: formatCreditSummary(updatedCredits[0]),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("retireCredits error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

/**
 * POST /api/credits/transfer
 * Transfer credits to another user
 */
export const transferCredits = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { toEmail, toWalletAddress, amount, memo, txHash } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    if (!toEmail && !toWalletAddress) {
      return res.status(400).json({ error: "Recipient email or wallet address required" });
    }

    await client.query("BEGIN");

    // Find recipient user
    let recipientQuery = "";
    let recipientParam = null;

    if (toEmail) {
      recipientQuery = "SELECT id, email, wallet_address FROM users WHERE email = $1";
      recipientParam = toEmail;
    } else {
      recipientQuery = "SELECT id, email, wallet_address FROM users WHERE wallet_address = $1";
      recipientParam = toWalletAddress;
    }

    const { rows: recipientRows } = await client.query(recipientQuery, [recipientParam]);

    if (recipientRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Recipient not found" });
    }

    const recipientId = recipientRows[0].id;

    if (recipientId === userId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot transfer credits to yourself" });
    }

    // Check sender balance
    const { rows: senderCredits } = await client.query(
      `SELECT * FROM carbon_credits WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    if (senderCredits.length === 0 || parseFloat(senderCredits[0].available_balance) < amount) {
      await client.query("ROLLBACK");
      const available = senderCredits.length > 0 ? parseFloat(senderCredits[0].available_balance) : 0;
      return res.status(400).json({
        error: `Insufficient credits. Available: ${available} kg CO₂`,
      });
    }

    // Ensure recipient has credit record
    await ensureCreditRecord(recipientId, recipientRows[0].wallet_address);

    // Insert transfer record
    const { rows: transferRows } = await client.query(
      `INSERT INTO credit_transfers 
       (from_user_id, to_user_id, amount, memo, tx_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [userId, recipientId, amount, memo || null, txHash || null]
    );

    // Update sender balance
    await client.query(
      `UPDATE carbon_credits 
       SET available_balance = available_balance - $1,
           total_transferred_out = total_transferred_out + $1
       WHERE user_id = $2`,
      [amount, userId]
    );

    // Update recipient balance
    await client.query(
      `UPDATE carbon_credits 
       SET available_balance = available_balance + $1,
           total_transferred_in = total_transferred_in + $1
       WHERE user_id = $2`,
      [amount, recipientId]
    );

    // Get updated sender balance
    const { rows: updatedCredits } = await client.query(
      `SELECT * FROM carbon_credits WHERE user_id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      transfer: {
        id: transferRows[0].id,
        toEmail: recipientRows[0].email,
        amount,
        memo: memo || null,
        txHash: txHash || null,
        createdAt: transferRows[0].created_at,
      },
      credits: formatCreditSummary(updatedCredits[0]),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("transferCredits error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

/**
 * GET /api/credits/history
 * Get credit transaction history (issuances, retirements, transfers)
 */
export const getHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    // Get issuances
    const { rows: issuances } = await pool.query(
      `SELECT 
        ci.id, ci.tree_id, ci.amount, ci.tx_hash, ci.period_start, ci.period_end, ci.created_at,
        t.metadata->>'name' as tree_name
       FROM credit_issuances ci
       LEFT JOIN trees t ON t.id = ci.tree_id
       WHERE ci.user_id = $1
       ORDER BY ci.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get retirements
    const { rows: retirements } = await pool.query(
      `SELECT id, amount, reason, beneficiary_name, certificate_number, tx_hash, created_at
       FROM credit_retirements
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get transfers (sent)
    const { rows: transfersSent } = await pool.query(
      `SELECT 
        ct.id, ct.amount, ct.memo, ct.tx_hash, ct.created_at,
        u.email as to_email
       FROM credit_transfers ct
       JOIN users u ON u.id = ct.to_user_id
       WHERE ct.from_user_id = $1
       ORDER BY ct.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get transfers (received)
    const { rows: transfersReceived } = await pool.query(
      `SELECT 
        ct.id, ct.amount, ct.memo, ct.tx_hash, ct.created_at,
        u.email as from_email
       FROM credit_transfers ct
       JOIN users u ON u.id = ct.from_user_id
       WHERE ct.to_user_id = $1
       ORDER BY ct.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Combine and sort all transactions
    const transactions = [
      ...issuances.map((i) => ({
        type: "issuance",
        id: i.id,
        amount: parseFloat(i.amount),
        treeName: i.tree_name || `Tree #${i.tree_id}`,
        treeId: i.tree_id,
        periodStart: i.period_start,
        periodEnd: i.period_end,
        txHash: i.tx_hash,
        createdAt: i.created_at,
      })),
      ...retirements.map((r) => ({
        type: "retirement",
        id: r.id,
        amount: parseFloat(r.amount),
        reason: r.reason,
        beneficiaryName: r.beneficiary_name,
        certificateNumber: r.certificate_number,
        txHash: r.tx_hash,
        createdAt: r.created_at,
      })),
      ...transfersSent.map((t) => ({
        type: "transfer_sent",
        id: t.id,
        amount: parseFloat(t.amount),
        toEmail: t.to_email,
        memo: t.memo,
        txHash: t.tx_hash,
        createdAt: t.created_at,
      })),
      ...transfersReceived.map((t) => ({
        type: "transfer_received",
        id: t.id,
        amount: parseFloat(t.amount),
        fromEmail: t.from_email,
        memo: t.memo,
        txHash: t.tx_hash,
        createdAt: t.created_at,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({
      transactions,
      pagination: {
        limit,
        offset,
        hasMore: transactions.length === limit,
      },
    });
  } catch (err) {
    console.error("getHistory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/credits/retirements
 * Get list of user's retirement certificates
 */
export const getRetirements = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { rows } = await pool.query(
      `SELECT id, amount, reason, beneficiary_name, certificate_number, tx_hash, created_at
       FROM credit_retirements
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const retirements = rows.map((r) => ({
      id: r.id,
      amount: parseFloat(r.amount),
      reason: r.reason,
      beneficiaryName: r.beneficiary_name,
      certificateNumber: r.certificate_number,
      txHash: r.tx_hash,
      createdAt: r.created_at,
    }));

    return res.json({ retirements });
  } catch (err) {
    console.error("getRetirements error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/credits/contract-info
 * Get CarbonCredit contract address and info
 */
export const getContractInfo = async (req, res) => {
  try {
    const contractDeployed = carbonCreditAbi && carbonCreditAddress;

    return res.json({
      deployed: contractDeployed,
      treeRegistryAddress: TREE_REGISTRY_ADDRESS,
      carbonCreditAddress: carbonCreditAddress || null,
    });
  } catch (err) {
    console.error("getContractInfo error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// ============================================================
// Cron-Based Accrual System Endpoints
// ============================================================

/**
 * GET /api/credits/accrual-status
 * Get credit accrual status for user's trees
 */
export const getAccrualStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    // Get trees with accrual info
    const { rows: trees } = await pool.query(
      `SELECT 
        t.id,
        t.metadata->>'name' as name,
        t.status,
        t.carbon_absorption_kg_per_year as absorption_rate,
        t.registered_at,
        t.credits_accrued_until,
        t.total_credits_accrued,
        t.death_reported_at,
        t.death_confirmed_at
       FROM trees t
       WHERE t.owner_user_id = $1
       ORDER BY t.id DESC`,
      [userId]
    );

    // Get latest accrual log
    const { rows: logs } = await pool.query(
      `SELECT run_date, status, trees_processed, credits_issued, completed_at
       FROM credit_accrual_logs
       ORDER BY run_date DESC
       LIMIT 1`
    );

    // Get pending issuances for this user
    const { rows: pending } = await pool.query(
      `SELECT COUNT(*) as count, SUM(amount) as total
       FROM pending_issuances
       WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );

    return res.json({
      trees: trees.map((t) => ({
        id: t.id,
        name: t.name || `Tree #${t.id}`,
        status: t.status,
        absorptionRate: parseFloat(t.absorption_rate) || 0,
        registeredAt: t.registered_at,
        creditsAccruedUntil: t.credits_accrued_until,
        totalCreditsAccrued: parseFloat(t.total_credits_accrued) || 0,
        isDead: t.status === "dead",
        deathReportedAt: t.death_reported_at,
        deathConfirmedAt: t.death_confirmed_at,
      })),
      lastAccrualRun: logs[0] || null,
      pendingIssuances: {
        count: parseInt(pending[0]?.count) || 0,
        totalAmount: parseFloat(pending[0]?.total) || 0,
      },
    });
  } catch (err) {
    console.error("getAccrualStatus error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/credits/slash-history
 * Get history of credits slashed from user (dead trees, etc)
 */
export const getSlashHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { rows } = await pool.query(
      `SELECT 
        cs.id,
        cs.tree_id,
        cs.amount,
        cs.reason,
        cs.explanation,
        cs.tx_hash,
        cs.created_at,
        t.metadata->>'name' as tree_name
       FROM credit_slashes cs
       JOIN trees t ON t.id = cs.tree_id
       WHERE cs.user_id = $1
       ORDER BY cs.created_at DESC`,
      [userId]
    );

    return res.json({
      slashes: rows.map((r) => ({
        id: r.id,
        treeId: r.tree_id,
        treeName: r.tree_name || `Tree #${r.tree_id}`,
        amount: parseFloat(r.amount),
        reason: r.reason,
        explanation: r.explanation,
        txHash: r.tx_hash,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error("getSlashHistory error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * POST /api/credits/trigger-accrual
 * Manually trigger credit accrual (admin/testing endpoint)
 */
export const triggerAccrual = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    // Note: In production, add admin check here
    // if (!req.user.isAdmin) return res.status(403).json({ error: "Admin only" });

    // Import and run the accrual service
    const { triggerManualAccrual } = await import("../services/creditAccrual.js");
    await triggerManualAccrual();

    return res.json({
      success: true,
      message: "Credit accrual triggered. Check logs for results.",
    });
  } catch (err) {
    console.error("triggerAccrual error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/credits/accrual-logs
 * Get accrual job run history (admin/debug endpoint)
 */
export const getAccrualLogs = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const limit = Math.min(parseInt(req.query.limit) || 30, 100);

    const { rows } = await pool.query(
      `SELECT id, run_date, status, trees_processed, credits_accrued, 
              credits_issued, errors_count, error_message, started_at, completed_at
       FROM credit_accrual_logs
       ORDER BY run_date DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({
      logs: rows.map((r) => ({
        id: r.id,
        runDate: r.run_date,
        status: r.status,
        treesProcessed: r.trees_processed,
        creditsAccrued: parseFloat(r.credits_accrued) || 0,
        creditsIssued: parseFloat(r.credits_issued) || 0,
        errorsCount: r.errors_count,
        errorMessage: r.error_message,
        startedAt: r.started_at,
        completedAt: r.completed_at,
      })),
    });
  } catch (err) {
    console.error("getAccrualLogs error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
