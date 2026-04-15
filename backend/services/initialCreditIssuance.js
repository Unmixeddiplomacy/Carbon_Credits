/**
 * Initial Credit Issuance Service
 * 
 * Handles retroactive credit assignment when a tree is first activated.
 * 
 * BUSINESS LOGIC:
 * When a tree is planted before registration, it has already been absorbing
 * CO2 during that period. This service calculates and issues those credits
 * at the time of first verification/activation.
 * 
 * CALCULATION:
 * - Period: plantedAt → activationDate (today)
 * - Daily rate = absorptionKgPerYear / 365
 * - Initial credits = dailyRate × days
 * 
 * CONSTRAINTS:
 * - Maximum retroactive period: 10 years (to prevent abuse)
 * - Minimum credits to issue: 0.001 kg (skip if below)
 * - Tree must be going from "pending" → "active"
 * 
 * RECORDS CREATED:
 * - credit_issuances: Audit record of initial credit allocation
 * - Updates carbon_credits: Adds to user's available balance
 * - Updates trees: Sets total_credits_accrued and credits_accrued_until
 */

import pool from "../config/db.js";

// ============================================================
// Configuration
// ============================================================
const CONFIG = {
  // Maximum years we'll give retroactive credits for
  MAX_RETROACTIVE_YEARS: 10,
  
  // Minimum credits worth issuing (kg CO2)
  MIN_CREDITS_TO_ISSUE: 0.001,
  
  // Days in a year for calculation
  DAYS_PER_YEAR: 365,
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Calculate days between two dates (inclusive of start, exclusive of end)
 */
function daysBetween(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate - startDate) / oneDay);
}

/**
 * Parse and validate a planted date
 * Returns Date object or null if invalid
 */
function parsePlantedDate(plantedAtValue) {
  if (!plantedAtValue) return null;
  
  // Handle various formats
  const date = new Date(plantedAtValue);
  
  // Validate it's a real date
  if (isNaN(date.getTime())) return null;
  
  // Date can't be in the future
  if (date > new Date()) return null;
  
  return date;
}

/**
 * Calculate initial credits for a tree based on planted date
 * 
 * @param {Date} plantedDate - When the tree was planted
 * @param {Date} activationDate - When the tree is being activated (usually today)
 * @param {number} absorptionKgPerYear - Tree's annual absorption rate
 * @returns {Object} { credits, daysAccrued, periodStart, periodEnd, capped }
 */
function calculateInitialCredits(plantedDate, activationDate, absorptionKgPerYear) {
  // Calculate days since planting
  let daysAccrued = daysBetween(plantedDate, activationDate);
  let capped = false;
  
  // Cap at maximum retroactive period
  const maxDays = CONFIG.MAX_RETROACTIVE_YEARS * CONFIG.DAYS_PER_YEAR;
  if (daysAccrued > maxDays) {
    daysAccrued = maxDays;
    capped = true;
  }
  
  // Don't issue for negative or zero days
  if (daysAccrued <= 0) {
    return { credits: 0, daysAccrued: 0, periodStart: activationDate, periodEnd: activationDate, capped: false };
  }
  
  // Calculate credits
  const dailyRate = absorptionKgPerYear / CONFIG.DAYS_PER_YEAR;
  const credits = dailyRate * daysAccrued;
  
  // Calculate period start (may be adjusted if capped)
  const periodStart = capped 
    ? new Date(activationDate.getTime() - (maxDays * 24 * 60 * 60 * 1000))
    : plantedDate;
  
  return {
    credits: Math.round(credits * 10000) / 10000, // Round to 4 decimal places
    daysAccrued,
    periodStart,
    periodEnd: activationDate,
    capped,
  };
}

// ============================================================
// Main Service Function
// ============================================================

/**
 * Issue initial credits for a tree at activation time
 * 
 * This calculates retroactive credits from plantedAt to today and:
 * 1. Creates a credit_issuances record
 * 2. Updates the user's carbon_credits balance
 * 3. Updates the tree's total_credits_accrued
 * 
 * @param {number} treeId - Database ID of the tree
 * @param {number} userId - Database ID of the tree owner
 * @returns {Object} { success, credits, message, details }
 */
export async function issueInitialCredits(treeId, userId) {
  const activationDate = new Date();
  const activationDateStr = activationDate.toISOString().split("T")[0];
  
  console.log(`[InitialCredits] Processing tree ${treeId} for user ${userId}`);
  
  try {
    // 1. Fetch tree data
    const treeResult = await pool.query(
      `SELECT 
        id,
        metadata,
        carbon_absorption_kg_per_year,
        status,
        total_credits_accrued
       FROM trees 
       WHERE id = $1 AND owner_user_id = $2`,
      [treeId, userId]
    );
    
    if (treeResult.rows.length === 0) {
      return { success: false, credits: 0, message: "Tree not found or not owned by user" };
    }
    
    const tree = treeResult.rows[0];
    
    // 2. Get absorption rate
    let absorptionKgPerYear = parseFloat(tree.carbon_absorption_kg_per_year) || 0;
    if (absorptionKgPerYear === 0 && tree.metadata?.absorptionKgPerYear) {
      absorptionKgPerYear = parseFloat(tree.metadata.absorptionKgPerYear) || 0;
    }
    
    if (absorptionKgPerYear <= 0) {
      console.log(`[InitialCredits] Tree ${treeId} has no absorption rate, skipping`);
      return { success: true, credits: 0, message: "Tree has no absorption rate configured" };
    }
    
    // 3. Get planted date from metadata
    const plantedDate = parsePlantedDate(tree.metadata?.plantedAt);
    
    if (!plantedDate) {
      console.log(`[InitialCredits] Tree ${treeId} has no valid plantedAt date, using today`);
      // No plantedAt = no retroactive credits, but still success (cron will handle going forward)
      return { 
        success: true, 
        credits: 0, 
        message: "No planted date found, credits will accrue from today" 
      };
    }
    
    // 4. Calculate initial credits
    const calculation = calculateInitialCredits(plantedDate, activationDate, absorptionKgPerYear);
    
    if (calculation.credits < CONFIG.MIN_CREDITS_TO_ISSUE) {
      console.log(`[InitialCredits] Tree ${treeId} initial credits too small (${calculation.credits}), skipping`);
      return { 
        success: true, 
        credits: 0, 
        message: "Initial credits too small to issue",
        details: calculation 
      };
    }
    
    console.log(`[InitialCredits] Tree ${treeId}: ${calculation.daysAccrued} days, ${calculation.credits.toFixed(4)} kg CO2`);
    
    // 5. Create credit issuance record
    await pool.query(
      `INSERT INTO credit_issuances 
       (user_id, tree_id, amount, period_start, period_end, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        treeId,
        calculation.credits,
        calculation.periodStart.toISOString().split("T")[0],
        calculation.periodEnd.toISOString().split("T")[0],
        `Initial retroactive credits from planting date${calculation.capped ? ' (capped at 10 years)' : ''}`
      ]
    );
    
    // 6. Update user's carbon credits balance
    await pool.query(
      `INSERT INTO carbon_credits (user_id, available_balance, total_issued)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         available_balance = carbon_credits.available_balance + $2,
         total_issued = carbon_credits.total_issued + $2,
         updated_at = NOW()`,
      [userId, calculation.credits]
    );
    
    // 7. Update tree's total credits accrued
    // Note: credits_accrued_until is set by activateTree() to today
    await pool.query(
      `UPDATE trees 
       SET total_credits_accrued = COALESCE(total_credits_accrued, 0) + $1
       WHERE id = $2`,
      [calculation.credits, treeId]
    );
    
    console.log(`[InitialCredits] Tree ${treeId}: Issued ${calculation.credits.toFixed(4)} kg CO2 to user ${userId}`);
    
    return {
      success: true,
      credits: calculation.credits,
      message: `Issued ${calculation.credits.toFixed(4)} kg CO2 for ${calculation.daysAccrued} days since planting`,
      details: {
        daysAccrued: calculation.daysAccrued,
        periodStart: calculation.periodStart,
        periodEnd: calculation.periodEnd,
        absorptionRate: absorptionKgPerYear,
        capped: calculation.capped,
      },
    };
    
  } catch (err) {
    console.error(`[InitialCredits] Error processing tree ${treeId}:`, err);
    return { success: false, credits: 0, message: err.message };
  }
}

/**
 * Get summary of initial credits calculation (preview without issuing)
 * Useful for showing user what they'll receive before activation
 * 
 * @param {number} treeId - Database ID of the tree
 * @returns {Object} Preview of initial credits
 */
export async function previewInitialCredits(treeId) {
  try {
    const treeResult = await pool.query(
      `SELECT metadata, carbon_absorption_kg_per_year FROM trees WHERE id = $1`,
      [treeId]
    );
    
    if (treeResult.rows.length === 0) {
      return { success: false, message: "Tree not found" };
    }
    
    const tree = treeResult.rows[0];
    
    let absorptionKgPerYear = parseFloat(tree.carbon_absorption_kg_per_year) || 0;
    if (absorptionKgPerYear === 0 && tree.metadata?.absorptionKgPerYear) {
      absorptionKgPerYear = parseFloat(tree.metadata.absorptionKgPerYear) || 0;
    }
    
    const plantedDate = parsePlantedDate(tree.metadata?.plantedAt);
    
    if (!plantedDate || absorptionKgPerYear <= 0) {
      return {
        success: true,
        credits: 0,
        message: "No retroactive credits (missing planted date or absorption rate)",
      };
    }
    
    const calculation = calculateInitialCredits(plantedDate, new Date(), absorptionKgPerYear);
    
    return {
      success: true,
      credits: calculation.credits,
      daysAccrued: calculation.daysAccrued,
      periodStart: calculation.periodStart,
      periodEnd: calculation.periodEnd,
      absorptionRate: absorptionKgPerYear,
      capped: calculation.capped,
      message: calculation.credits > 0 
        ? `${calculation.credits.toFixed(4)} kg CO2 for ${calculation.daysAccrued} days since planting`
        : "No retroactive credits available",
    };
    
  } catch (err) {
    console.error(`[InitialCredits] Preview error for tree ${treeId}:`, err);
    return { success: false, message: err.message };
  }
}

export default {
  issueInitialCredits,
  previewInitialCredits,
  CONFIG,
};
