/**
 * Verification Controller - Production-Ready Implementation
 * 
 * Handles tree verification requests with modular, clean logic:
 * 
 * VERIFICATION FLOW (Option A - Auto-approve First Verification):
 * 
 * 1. FIRST VERIFICATION (tree.status = "pending"):
 *    - User submits photo + GPS coordinates
 *    - Backend saves GPS to tree
 *    - Tree automatically becomes "active"
 *    - Verification marked as "approved"
 *    - Initial retroactive credits issued (plantedAt → today)
 *    - Tree starts earning credits immediately
 * 
 * 2. PERIODIC VERIFICATION (tree.status = "active"):
 *    - User submits photo + GPS coordinates
 *    - Distance calculated from tree's stored GPS
 *    - Auto-approve if within 100m (normal variation)
 *    - Flag "needs_review" if > 1000m (possible location error)
 *    - Otherwise stays "pending" for optional admin review
 * 
 * 3. DEATH REPORT (Auto-approve, same as first verification):
 *    - User submits photo + GPS + death date
 *    - Auto-approve immediately (no review stage)
 *    - Tree marked "dead" with user-provided death date
 *    - Credits accrued after death date will be slashed by cron
 * 
 * HELPER FUNCTIONS:
 * - determineVerificationStatus(): Modular status logic (tree state + distance)
 * - determineDeathReportStatus(): Always auto-approve (same as first verification)
 * - activateTree(): Save GPS + activate tree (first verification)
 * - updateTreePeriodicGPS(): Update GPS for periodic verifications
 * 
 * STORAGE NOTES:
 * - GPS coordinates from verifications only (not collected during registration)
 * - First verification establishes the canonical GPS location
 * - Later verification GPS updates keep location current
 */

import pool from "../config/db.js";
import { issueInitialCredits } from "../services/initialCreditIssuance.js";
import { syncSlashCreditsOnChain } from "../services/carbonCreditOnchain.service.js";

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Determine verification status based on tree state and verification type
 * 
 * Logic:
 * - FIRST VERIFICATION (tree.status === "pending"): Auto-approve immediately
 * - PERIODIC VERIFICATION (tree.status === "active"): Requires admin review
 *   - If tree has old GPS and distance is within 100m: auto-approve
 *   - If distance > 1000m: flag for review
 *   - Otherwise: pending review
 */
function determineVerificationStatus(treeStatus, distanceFromTree) {
  // First verification: always auto-approve to activate tree
  if (treeStatus === "pending") {
    return "approved";
  }

  // Periodic verification on active tree: distance-based approval
  if (treeStatus === "active") {
    if (distanceFromTree === null) {
      // No GPS comparison possible (shouldn't happen for active tree, but safety)
      return "pending";
    }
    if (distanceFromTree <= 100) {
      // Within 100m of registered location: auto-approve
      return "approved";
    }
    if (distanceFromTree > 1000) {
      // Very far: flag for admin review
      return "needs_review";
    }
    // Between 100-1000m: needs review
    return "pending";
  }

  // Tree in other state (shouldn't happen for verification)
  return "pending";
}

/**
 * Activate a tree: save GPS coordinates and set status to active
 * Also sets last_verified_at for marketplace verification tracking
 * (Called after first verification is approved)
 */
async function activateTree(treeId, latitude, longitude) {
  await pool.query(
    `UPDATE trees 
     SET latitude = $1, longitude = $2, status = 'active', 
         last_verified_at = NOW(),
         verification_required_by = NULL
     WHERE id = $3`,
    [latitude, longitude, treeId]
  );
}

/**
 * Update tree with periodic verification GPS (tree already active)
 * Also updates last_verified_at for marketplace verification tracking
 * Optionally store the most recent GPS if needed for future distance checks
 */
async function updateTreePeriodicGPS(treeId, latitude, longitude) {
  // Update stored GPS and verification timestamp
  await pool.query(
    `UPDATE trees 
     SET latitude = $1, longitude = $2, 
         last_verified_at = NOW(),
         verification_required_by = NULL
     WHERE id = $3`,
    [latitude, longitude, treeId]
  );
}

/**
 * Submit a new verification for a tree
 * POST /api/verifications
 * 
 * Flow:
 * 1. First verification (tree.status='pending'): Auto-approved, tree becomes active
 * 2. Periodic verification (tree.status='active'): Distance-based or requires review
 */
export const submitVerification = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const {
      treeId,
      photoUrl,
      latitude,
      longitude,
      verificationType = "periodic",
      notes,
      deviceInfo,
    } = req.body;

    // Validate required fields
    if (!treeId || !photoUrl || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required fields: treeId, photoUrl, latitude, longitude" });
    }

    // Verify tree exists and user owns it
    const treeResult = await pool.query(
      "SELECT id, owner_user_id, latitude, longitude, status FROM trees WHERE id = $1",
      [treeId]
    );
    
    if (!treeResult.rows[0]) {
      return res.status(404).json({ error: "Tree not found" });
    }

    const tree = treeResult.rows[0];
    
    if (tree.owner_user_id !== userId) {
      return res.status(403).json({ error: "You can only verify your own trees" });
    }

    if (tree.status === "dead" || tree.status === "removed") {
      return res.status(400).json({ error: "Cannot verify a dead or removed tree" });
    }

    // Calculate distance from tree's registered location (if tree has GPS)
    let distanceFromTree = null;
    if (tree.latitude && tree.longitude) {
      distanceFromTree = calculateDistance(
        tree.latitude,
        tree.longitude,
        latitude,
        longitude
      );
    }

    // Determine verification status (modular logic)
    const verificationStatus = determineVerificationStatus(tree.status, distanceFromTree);

    // Insert verification record
    const insertResult = await pool.query(
      `INSERT INTO tree_verifications 
       (tree_id, user_id, verification_type, status, photo_url, 
        capture_latitude, capture_longitude, distance_from_tree, device_info, user_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, status, created_at`,
      [
        treeId,
        userId,
        verificationType === "initial" || tree.status === "pending" ? "initial" : verificationType,
        verificationStatus,
        photoUrl,
        latitude,
        longitude,
        distanceFromTree,
        deviceInfo ? JSON.stringify(deviceInfo) : null,
        notes,
      ]
    );

    const verification = insertResult.rows[0];

    // Post-verification updates based on verification status
    if (verificationStatus === "approved") {
      if (tree.status === "pending") {
        // FIRST VERIFICATION: Activate tree and store GPS
        await activateTree(treeId, latitude, longitude);
        // Issue initial retroactive credits (plantedAt → today)
        await issueInitialCredits(treeId, userId);
      } else if (tree.status === "active") {
        // Update stored GPS and last_verified_at
        await updateTreePeriodicGPS(treeId, latitude, longitude);
      }
    }

    // Build response message
    let message;
    if (tree.status === "pending" && verificationStatus === "approved") {
      // First verification success
      message = "Tree verified and activated! Now earning credits.";
    } else if (verificationStatus === "approved") {
      message = "Verification approved.";
    } else if (verificationStatus === "needs_review") {
      message = "Verification submitted. Location differs from original—awaiting admin review.";
    } else {
      message = "Verification submitted and pending review.";
    }

    return res.status(201).json({
      verification: {
        id: verification.id,
        status: verification.status,
        createdAt: verification.created_at,
        distanceFromTree: distanceFromTree ? Math.round(distanceFromTree) : null,
        message,
      },
    });
  } catch (err) {
    console.error("submitVerification error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Determine death report status
 * 
 * Logic: Always auto-approve (same as first verification)
 * Credit slashing handles any discrepancies via death date
 */
function determineDeathReportStatus() {
  // Always auto-approve death reports (same flow as first verification)
  return "approved";
}

/**
 * Report a tree as dead
 * POST /api/verifications/report-death
 * Body: { treeId, photoUrl, latitude, longitude, deathDate, notes?, deviceInfo? }
 * 
 * Flow (same as first verification - auto-approve):
 * - User provides the date when tree died (deathDate)
 * - Auto-approve immediately (no review stage)
 * - Tree marked "dead" with user-provided death date
 * - Credit slashing will use this date to calculate over-issued credits
 */
export const reportTreeDeath = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { treeId, photoUrl, latitude, longitude, deathDate, notes, deviceInfo } = req.body;

    if (!treeId || !photoUrl || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate and parse death date
    let parsedDeathDate;
    if (deathDate) {
      parsedDeathDate = new Date(deathDate);
      if (isNaN(parsedDeathDate.getTime())) {
        return res.status(400).json({ error: "Invalid death date format" });
      }
      // Death date can't be in the future
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (parsedDeathDate > today) {
        return res.status(400).json({ error: "Death date cannot be in the future" });
      }
    } else {
      // Default to today if no death date provided
      parsedDeathDate = new Date();
    }

    // Verify tree exists and user owns it
    const treeResult = await pool.query(
          `SELECT t.id, t.owner_user_id, t.status, t.latitude, t.longitude, 
            t.metadata->>'plantedAt' as planted_at,
            t.credits_accrued_until,
            t.chain_tree_id,
              u.wallet_address as owner_wallet
       FROM trees t
       JOIN users u ON u.id = t.owner_user_id
       WHERE t.id = $1`,
      [treeId]
    );

    if (!treeResult.rows[0]) {
      return res.status(404).json({ error: "Tree not found" });
    }

    const tree = treeResult.rows[0];

    if (tree.owner_user_id !== userId) {
      return res.status(403).json({ error: "You can only report death for your own trees" });
    }

    if (tree.status === "dead") {
      return res.status(400).json({ error: "Tree is already marked as dead" });
    }

    // Validate death date is not before tree was planted
    if (tree.planted_at) {
      const plantedDate = new Date(tree.planted_at);
      if (parsedDeathDate < plantedDate) {
        return res.status(400).json({ error: "Death date cannot be before tree was planted" });
      }
    }

    // Calculate distance
    let distanceFromTree = null;
    if (tree.latitude && tree.longitude) {
      distanceFromTree = calculateDistance(tree.latitude, tree.longitude, latitude, longitude);
    }

    // Always auto-approve (same as first verification)
    const deathStatus = determineDeathReportStatus();

    // Format death date for storage
    const deathDateStr = parsedDeathDate.toISOString().split("T")[0];

    // Create death report verification (store death date in notes for record)
    const insertResult = await pool.query(
      `INSERT INTO tree_verifications 
       (tree_id, user_id, verification_type, status, photo_url, 
        capture_latitude, capture_longitude, distance_from_tree, device_info, user_notes)
       VALUES ($1, $2, 'death_report', $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, status, created_at`,
      [
        treeId,
        userId,
        deathStatus,
        photoUrl,
        latitude,
        longitude,
        distanceFromTree,
        deviceInfo ? JSON.stringify(deviceInfo) : null,
        `Death date: ${deathDateStr}. ${notes || ""}`.trim(),
      ]
    );

    const verification = insertResult.rows[0];

    // Calculate and slash over-issued credits immediately
    let creditsToSlash = 0;
    let daysOverIssued = 0;
    if (tree.credits_accrued_until) {
      const accruedUntil = new Date(tree.credits_accrued_until);
      if (accruedUntil > parsedDeathDate) {
        // Credits were issued after tree died - need to slash
        const oneDay = 24 * 60 * 60 * 1000;
        daysOverIssued = Math.floor((accruedUntil - parsedDeathDate) / oneDay);
        
        // Get absorption rate from tree
        const absResult = await pool.query(
          `SELECT carbon_absorption_kg_per_year, metadata FROM trees WHERE id = $1`,
          [treeId]
        );
        if (absResult.rows[0]) {
          let absorptionRate = parseFloat(absResult.rows[0].carbon_absorption_kg_per_year) || 0;
          if (absorptionRate === 0 && absResult.rows[0].metadata?.absorptionKgPerYear) {
            absorptionRate = parseFloat(absResult.rows[0].metadata.absorptionKgPerYear) || 0;
          }
          creditsToSlash = (absorptionRate / 365) * daysOverIssued;
        }
      }
    }

    // Mark tree as dead with the user-provided death date (always approved)
    await pool.query(
      `UPDATE trees 
       SET status = 'dead', 
           death_reported_at = NOW(), 
           death_confirmed_at = $1
       WHERE id = $2`,
      [deathDateStr, treeId]
    );

    // Actually slash the credits immediately if needed
    if (creditsToSlash > 0) {
      // Record slash in credit_slashes table
      await pool.query(
        `INSERT INTO credit_slashes 
         (tree_id, user_id, amount, reason, explanation)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          treeId,
          userId,
          creditsToSlash,
          "tree_death",
          `Tree died on ${deathDateStr}. Over-issued ${daysOverIssued} days worth of credits.`
        ]
      );

      // Deduct from user's credit balance
      await pool.query(
        `UPDATE carbon_credits 
         SET available_balance = GREATEST(0, available_balance - $1),
             updated_at = NOW()
         WHERE user_id = $2`,
        [creditsToSlash, userId]
      );

      // Update tree's total credits accrued
      await pool.query(
        `UPDATE trees 
         SET total_credits_accrued = GREATEST(0, COALESCE(total_credits_accrued, 0) - $1)
         WHERE id = $2`,
        [creditsToSlash, treeId]
      );

      console.log(`[DeathReport] Slashed ${creditsToSlash.toFixed(4)} credits for tree ${treeId}`);

      await syncSlashCreditsOnChain({
        chainTreeId: tree.chain_tree_id,
        fromWallet: tree.owner_wallet,
        amountKg: creditsToSlash,
        reason: `tree_death:${deathDateStr}`,
        source: "tree_death",
        reference: `tree:${treeId}:verification:${verification.id}`,
      }).catch((err) => {
        console.error("[CarbonCredit] death slash sync failed:", err?.message || err);
      });
    }

    // Build response message (always approved now)
    let message;
    if (creditsToSlash > 0) {
      message = `Tree marked as dead (${deathDateStr}). ${creditsToSlash.toFixed(2)} kg CO2 over-issued credits have been deducted.`;
    } else {
      message = `Tree marked as dead (${deathDateStr}). Credits will stop accruing.`;
    }

    return res.status(201).json({
      verification: {
        id: verification.id,
        status: verification.status,
        createdAt: verification.created_at,
        distanceFromTree: distanceFromTree ? Math.round(distanceFromTree) : null,
        deathDate: deathDateStr,
        message,
        ...(creditsToSlash > 0 && {
          creditAdjustment: {
            daysOverIssued,
            creditsSlashed: Math.round(creditsToSlash * 10000) / 10000,
          },
        }),
      },
    });
  } catch (err) {
    console.error("reportTreeDeath error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get verifications for a specific tree
 * GET /api/verifications/tree/:treeId
 */
export const getTreeVerifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const treeId = Number(req.params.treeId);
    if (!Number.isFinite(treeId)) {
      return res.status(400).json({ error: "Invalid tree ID" });
    }

    // Check user owns tree or is admin
    const treeResult = await pool.query(
      "SELECT owner_user_id FROM trees WHERE id = $1",
      [treeId]
    );

    if (!treeResult.rows[0]) {
      return res.status(404).json({ error: "Tree not found" });
    }

    if (treeResult.rows[0].owner_user_id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { rows } = await pool.query(
      `SELECT id, verification_type, status, photo_url, 
              capture_latitude, capture_longitude, distance_from_tree,
              user_notes, review_notes, created_at, reviewed_at
       FROM tree_verifications
       WHERE tree_id = $1
       ORDER BY created_at DESC`,
      [treeId]
    );

    return res.json({
      verifications: rows.map((r) => ({
        id: r.id,
        type: r.verification_type,
        status: r.status,
        photoUrl: r.photo_url,
        latitude: parseFloat(r.capture_latitude),
        longitude: parseFloat(r.capture_longitude),
        distanceFromTree: r.distance_from_tree ? Math.round(r.distance_from_tree) : null,
        userNotes: r.user_notes,
        reviewNotes: r.review_notes,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
      })),
    });
  } catch (err) {
    console.error("getTreeVerifications error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get all pending verifications (admin only)
 * GET /api/verifications/pending
 */
export const getPendingVerifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    // TODO: Add proper admin check
    // For now, allow any authenticated user to view (adjust for production)

    const { rows } = await pool.query(
      `SELECT v.id, v.tree_id, v.user_id, v.verification_type, v.status,
              v.photo_url, v.capture_latitude, v.capture_longitude, 
              v.distance_from_tree, v.user_notes, v.created_at,
              t.metadata->>'name' as tree_name,
              u.email as user_email
       FROM tree_verifications v
       JOIN trees t ON t.id = v.tree_id
       JOIN users u ON u.id = v.user_id
       WHERE v.status IN ('pending', 'needs_review')
       ORDER BY v.created_at ASC`
    );

    return res.json({
      verifications: rows.map((r) => ({
        id: r.id,
        treeId: r.tree_id,
        userId: r.user_id,
        type: r.verification_type,
        status: r.status,
        photoUrl: r.photo_url,
        latitude: parseFloat(r.capture_latitude),
        longitude: parseFloat(r.capture_longitude),
        distanceFromTree: r.distance_from_tree ? Math.round(r.distance_from_tree) : null,
        userNotes: r.user_notes,
        treeName: r.tree_name,
        userEmail: r.user_email,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error("getPendingVerifications error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Review a verification (admin)
 * POST /api/verifications/:id/review
 * Body: { status: 'approved' | 'rejected', notes? }
 */
export const reviewVerification = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const verificationId = Number(req.params.id);
    const { status, notes } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
    }

    // Get verification
    const verResult = await pool.query(
      `SELECT v.*, t.owner_user_id as tree_owner_id, t.status as tree_status
       FROM tree_verifications v
       JOIN trees t ON t.id = v.tree_id
       WHERE v.id = $1`,
      [verificationId]
    );

    if (!verResult.rows[0]) {
      return res.status(404).json({ error: "Verification not found" });
    }

    const verification = verResult.rows[0];

    // Update verification status
    await pool.query(
      `UPDATE tree_verifications 
       SET status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [status, notes, userId, verificationId]
    );

    // Handle death reports
    if (verification.verification_type === "death_report" && status === "approved") {
      // Extract death date from user_notes (format: "Death date: YYYY-MM-DD. ...")
      let deathDate = new Date();
      if (verification.user_notes) {
        const match = verification.user_notes.match(/Death date: (\d{4}-\d{2}-\d{2})/);
        if (match) {
          deathDate = new Date(match[1]);
        }
      }
      
      // Mark tree as dead with the user-provided death date
      await pool.query(
        `UPDATE trees 
         SET status = 'dead', death_confirmed_at = $1
         WHERE id = $2`,
        [deathDate.toISOString().split("T")[0], verification.tree_id]
      );

      // Note: Credit slashing will be handled by the cron job service
      // when it processes dead trees
    }

    return res.json({
      success: true,
      message:
        status === "approved" && verification.verification_type === "death_report"
          ? "Death confirmed. Credits will be adjusted."
          : `Verification ${status}`,
    });
  } catch (err) {
    console.error("reviewVerification error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get user's verification history
 * GET /api/verifications/my
 */
export const getMyVerifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { rows } = await pool.query(
      `SELECT v.id, v.tree_id, v.verification_type, v.status, 
              v.photo_url, v.capture_latitude, v.capture_longitude,
              v.distance_from_tree, v.created_at, v.reviewed_at,
              t.metadata->>'name' as tree_name
       FROM tree_verifications v
       JOIN trees t ON t.id = v.tree_id
       WHERE v.user_id = $1
       ORDER BY v.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.json({
      verifications: rows.map((r) => ({
        id: r.id,
        treeId: r.tree_id,
        treeName: r.tree_name,
        type: r.verification_type,
        status: r.status,
        photoUrl: r.photo_url,
        latitude: r.capture_latitude ? parseFloat(r.capture_latitude) : null,
        longitude: r.capture_longitude ? parseFloat(r.capture_longitude) : null,
        distanceFromTree: r.distance_from_tree ? Math.round(r.distance_from_tree) : null,
        createdAt: r.created_at,
        reviewedAt: r.reviewed_at,
      })),
    });
  } catch (err) {
    console.error("getMyVerifications error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get dead trees for a user (for viewing history)
 * GET /api/verifications/dead-trees
 */
export const getDeadTrees = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { rows } = await pool.query(
      `SELECT t.id, t.metadata->>'name' as name, t.metadata->>'species' as species,
              t.registered_at, t.death_reported_at, t.death_confirmed_at,
              t.total_credits_accrued, t.carbon_absorption_kg_per_year,
              cs.amount as credits_slashed, cs.reason as slash_reason
       FROM trees t
       LEFT JOIN credit_slashes cs ON cs.tree_id = t.id
       WHERE t.owner_user_id = $1 AND t.status = 'dead'
       ORDER BY t.death_confirmed_at DESC`,
      [userId]
    );

    return res.json({
      deadTrees: rows.map((r) => ({
        id: r.id,
        name: r.name,
        species: r.species,
        registeredAt: r.registered_at,
        deathReportedAt: r.death_reported_at,
        deathConfirmedAt: r.death_confirmed_at,
        totalCreditsAccrued: parseFloat(r.total_credits_accrued || 0),
        absorptionRate: parseFloat(r.carbon_absorption_kg_per_year || 0),
        creditsSlashed: r.credits_slashed ? parseFloat(r.credits_slashed) : null,
        slashReason: r.slash_reason,
      })),
    });
  } catch (err) {
    console.error("getDeadTrees error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
