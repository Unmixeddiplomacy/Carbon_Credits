/**
 * Marketplace Controller
 * 
 * Handles tree trading on the marketplace:
 * 
 * LISTING FLOW:
 * 1. User verifies tree (must be verified within last 2 days)
 * 2. User lists tree with price
 * 3. Tree appears on marketplace
 * 4. Buyer purchases tree
 * 5. Tree ownership + credits transfer to buyer
 * 
 * BUSINESS RULES:
 * - Only verified trees can be listed (verification within 2 days)
 * - Only tree owner can list/cancel
 * - Only one active listing per tree
 * - Credits accrued for tree transfer with ownership
 * - Seller must not have pending credits for the tree
 */

import pool from "../config/db.js";
import {
  issueTreeCertificates,
  issueCreditCertificates,
  getUserCertificates,
  getCertificateByNumber,
  formatCertificate,
} from "../services/certificate.service.js";
import { mintCertificateNFT } from "../services/blockchain.service.js";

// ============================================================
// Configuration
// ============================================================
const CONFIG = {
  // Maximum days since last verification to list
  MAX_VERIFICATION_AGE_DAYS: 2,
  // Minimum listing price
  MIN_LISTING_PRICE: 0.01,
  // Maximum listing price
  MAX_LISTING_PRICE: 1000000,
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Check if tree verification is current (within 2 days)
 */
function isVerificationCurrent(lastVerifiedAt) {
  // Temporarily: only require the tree to be verified at least once.
  // (No "verified within last N days" rule.)
  return Boolean(lastVerifiedAt);
}

/**
 * Calculate credits to transfer with tree (tree's accumulated credits)
 * This is based on the tree's contribution to the user's total
 */
async function calculateTreeCredits(treeId) {
  const result = await pool.query(
    `SELECT 
      COALESCE(SUM(ci.amount), 0) as total_issued,
      COALESCE(
        (SELECT SUM(cs.amount) FROM credit_slashes cs WHERE cs.tree_id = $1), 
        0
      ) as total_slashed
    FROM credit_issuances ci
    WHERE ci.tree_id = $1`,
    [treeId]
  );
  
  const issued = parseFloat(result.rows[0]?.total_issued) || 0;
  const slashed = parseFloat(result.rows[0]?.total_slashed) || 0;
  
  return Math.max(0, issued - slashed);
}

// ============================================================
// Controllers
// ============================================================

/**
 * List a tree for sale
 * POST /api/marketplace/list
 * Body: { treeId, price, description? }
 */
export const listTree = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { treeId, price, description } = req.body;

    // Validate inputs
    if (!treeId || price === undefined) {
      return res.status(400).json({ error: "Missing required fields: treeId, price" });
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < CONFIG.MIN_LISTING_PRICE || numPrice > CONFIG.MAX_LISTING_PRICE) {
      return res.status(400).json({ 
        error: `Price must be between ${CONFIG.MIN_LISTING_PRICE} and ${CONFIG.MAX_LISTING_PRICE}` 
      });
    }

    // Get tree details
    const treeResult = await pool.query(
      `SELECT t.*, 
              (SELECT MAX(v.created_at) FROM tree_verifications v 
               WHERE v.tree_id = t.id AND v.status = 'approved') as last_verified_at
       FROM trees t 
       WHERE t.id = $1`,
      [treeId]
    );

    if (!treeResult.rows[0]) {
      return res.status(404).json({ error: "Tree not found" });
    }

    const tree = treeResult.rows[0];

    // Verify ownership
    if (tree.owner_user_id !== userId) {
      return res.status(403).json({ error: "You can only list trees you own" });
    }

    // Check tree status
    if (tree.status !== "active") {
      return res.status(400).json({ error: `Cannot list a ${tree.status} tree` });
    }

    // Check verification is current
    if (!isVerificationCurrent(tree.last_verified_at)) {
      return res.status(400).json({ 
        error: "Tree must be verified at least once before listing. Please verify your tree first." 
      });
    }

    // Check for existing active listing
    const existingListing = await pool.query(
      `SELECT id FROM tree_listings WHERE tree_id = $1 AND status = 'active'`,
      [treeId]
    );

    if (existingListing.rows.length > 0) {
      return res.status(400).json({ error: "Tree already has an active listing" });
    }

    // Create listing
    const listingResult = await pool.query(
      `INSERT INTO tree_listings (tree_id, seller_user_id, price, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, tree_id, price, description, status, created_at`,
      [treeId, userId, numPrice, description || null]
    );

    const listing = listingResult.rows[0];

    // Get tree info for response
    const treeName = tree.metadata?.name || tree.metadata?.species || `Tree #${treeId}`;

    console.log(`[Marketplace] User ${userId} listed tree ${treeId} for $${numPrice}`);

    return res.status(201).json({
      listing: {
        ...listing,
        treeName,
        treeSpecies: tree.metadata?.species || "Unknown",
      },
      message: `"${treeName}" listed for sale at $${numPrice.toFixed(2)}`,
    });
  } catch (err) {
    console.error("listTree error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get all active marketplace listings
 * GET /api/marketplace/listings
 * Query: { limit?, offset?, minPrice?, maxPrice?, species? }
 */
export const getListings = async (req, res) => {
  try {
    const userId = req.user?.id; // Optional - for marking own listings
    const { 
      limit = 20, 
      offset = 0, 
      minPrice, 
      maxPrice, 
      species,
      sortBy = "created_at",
      sortOrder = "desc"
    } = req.query;

    // Build query with filters
    let whereClause = "l.status = 'active'";
    const params = [];
    let paramIndex = 1;

    if (minPrice !== undefined) {
      whereClause += ` AND l.price >= $${paramIndex++}`;
      params.push(parseFloat(minPrice));
    }

    if (maxPrice !== undefined) {
      whereClause += ` AND l.price <= $${paramIndex++}`;
      params.push(parseFloat(maxPrice));
    }

    if (species) {
      whereClause += ` AND t.metadata->>'species' ILIKE $${paramIndex++}`;
      params.push(`%${species}%`);
    }

    // Validate sort
    const validSorts = ["created_at", "price", "tree_id"];
    const validOrders = ["asc", "desc"];
    const sortColumn = validSorts.includes(sortBy) ? sortBy : "created_at";
    const order = validOrders.includes(sortOrder.toLowerCase()) ? sortOrder : "desc";

    // Get listings with tree and seller info
    const query = `
      SELECT 
        l.id as listing_id,
        l.tree_id,
        l.seller_user_id,
        l.price,
        l.description,
        l.status,
        l.created_at,
        t.metadata as tree_metadata,
        t.carbon_absorption_kg_per_year,
        t.total_credits_accrued,
        COALESCE(u.username, u.name, u.email) as seller_username,
        (SELECT MAX(v.created_at) FROM tree_verifications v 
         WHERE v.tree_id = t.id AND v.status = 'approved') as last_verified_at,
        (SELECT COUNT(*) FROM tree_verifications tv 
         WHERE tv.tree_id = t.id AND tv.status = 'approved') as verification_count
      FROM tree_listings l
      JOIN trees t ON t.id = l.tree_id
      JOIN users u ON u.id = l.seller_user_id
      WHERE ${whereClause}
      ORDER BY l.${sortColumn} ${order}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tree_listings l
      JOIN trees t ON t.id = l.tree_id
      WHERE ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.total) || 0;

    // Format listings
    const listings = result.rows.map(row => ({
      id: row.listing_id,
      treeId: row.tree_id,
      price: parseFloat(row.price),
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      isOwn: row.seller_user_id === userId,
      tree: {
        name: row.tree_metadata?.name || `Tree #${row.tree_id}`,
        species: row.tree_metadata?.species || "Unknown",
        plantedAt: row.tree_metadata?.plantedAt,
        absorptionRate: parseFloat(row.carbon_absorption_kg_per_year) || 0,
        totalCreditsAccrued: parseFloat(row.total_credits_accrued) || 0,
        lastVerifiedAt: row.last_verified_at,
        verificationCount: parseInt(row.verification_count) || 0,
      },
      seller: {
        id: row.seller_user_id,
        username: row.seller_username,
      },
    }));

    return res.json({
      listings,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + listings.length < total,
      },
    });
  } catch (err) {
    console.error("getListings error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get a single listing detail
 * GET /api/marketplace/listings/:id
 */
export const getListingDetail = async (req, res) => {
  try {
    const userId = req.user?.id;
    const listingId = parseInt(req.params.id);

    if (!Number.isFinite(listingId)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const result = await pool.query(
      `SELECT 
        l.*,
        t.metadata as tree_metadata,
        t.carbon_absorption_kg_per_year,
        t.total_credits_accrued,
        t.status as tree_status,
        t.chain_tree_id,
        COALESCE(u.username, u.name, u.email) as seller_username,
        u.email as seller_email,
        (SELECT MAX(v.created_at) FROM tree_verifications v 
         WHERE v.tree_id = t.id AND v.status = 'approved') as last_verified_at
      FROM tree_listings l
      JOIN trees t ON t.id = l.tree_id
      JOIN users u ON u.id = l.seller_user_id
      WHERE l.id = $1`,
      [listingId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const row = result.rows[0];

    // Calculate credits that would transfer
    const creditsToTransfer = await calculateTreeCredits(row.tree_id);

    return res.json({
      listing: {
        id: row.id,
        treeId: row.tree_id,
        price: parseFloat(row.price),
        description: row.description,
        status: row.status,
        createdAt: row.created_at,
        isOwn: row.seller_user_id === userId,
        creditsIncluded: creditsToTransfer,
        tree: {
          name: row.tree_metadata?.name || `Tree #${row.tree_id}`,
          species: row.tree_metadata?.species || "Unknown",
          plantedAt: row.tree_metadata?.plantedAt,
          absorptionRate: parseFloat(row.carbon_absorption_kg_per_year) || 0,
          totalCreditsAccrued: parseFloat(row.total_credits_accrued) || 0,
          lastVerifiedAt: row.last_verified_at,
          chainTreeId: row.chain_tree_id,
          treeStatus: row.tree_status,
        },
        seller: {
          id: row.seller_user_id,
          username: row.seller_username,
        },
      },
    });
  } catch (err) {
    console.error("getListingDetail error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Buy a tree from marketplace
 * POST /api/marketplace/buy/:listingId
 * Body: { paymentConfirmation? }
 */
export const buyTree = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const buyerId = req.user?.id;
    if (!buyerId) return res.status(401).json({ error: "Not authenticated" });

    const listingId = parseInt(req.params.listingId);
    if (!Number.isFinite(listingId)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    await client.query('BEGIN');

    // Lock the listing row for update
    const listingResult = await client.query(
      `SELECT l.*, t.owner_user_id as current_owner, t.owner_wallet, t.total_credits_accrued
       FROM tree_listings l
       JOIN trees t ON t.id = l.tree_id
       WHERE l.id = $1
       FOR UPDATE`,
      [listingId]
    );

    if (!listingResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Listing not found" });
    }

    const listing = listingResult.rows[0];

    // Validate purchase
    if (listing.status !== "active") {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "Listing is no longer active" });
    }

    if (listing.seller_user_id === buyerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "Cannot buy your own listing" });
    }

    // Calculate credits to transfer
    const creditsToTransfer = await calculateTreeCredits(listing.tree_id);

    // Create transaction record
    const txResult = await client.query(
      `INSERT INTO tree_transactions 
       (listing_id, tree_id, seller_user_id, buyer_user_id, sale_price, credits_transferred, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed')
       RETURNING id`,
      [listingId, listing.tree_id, listing.seller_user_id, buyerId, listing.price, creditsToTransfer]
    );
    const transactionId = txResult.rows[0].id;

    // Update listing status
    await client.query(
      `UPDATE tree_listings SET status = 'sold', sold_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [listingId]
    );

    // Get buyer's wallet
    const buyerResult = await client.query(
      `SELECT wallet_address FROM users WHERE id = $1`,
      [buyerId]
    );
    const buyerWallet = buyerResult.rows[0]?.wallet_address;

    // Transfer tree ownership
    await client.query(
      `UPDATE trees 
       SET owner_user_id = $1, 
           owner_wallet = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [buyerId, buyerWallet, listing.tree_id]
    );

    // Transfer credits if any
    if (creditsToTransfer > 0) {
      // Record credit transfer
      await client.query(
        `INSERT INTO credit_transfers 
         (transaction_id, tree_id, from_user_id, to_user_id, amount, transfer_type)
         VALUES ($1, $2, $3, $4, $5, 'tree_sale')`,
        [transactionId, listing.tree_id, listing.seller_user_id, buyerId, creditsToTransfer]
      );

      // Deduct from seller's balance
      await client.query(
        `UPDATE carbon_credits 
         SET available_balance = GREATEST(0, available_balance - $1),
             total_transferred_out = total_transferred_out + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [creditsToTransfer, listing.seller_user_id]
      );

      // Add to buyer's balance
      await client.query(
        `INSERT INTO carbon_credits (user_id, available_balance, total_transferred_in)
         VALUES ($1, $2, $2)
         ON CONFLICT (user_id) DO UPDATE SET
           available_balance = carbon_credits.available_balance + $2,
           total_transferred_in = carbon_credits.total_transferred_in + $2,
           updated_at = NOW()`,
        [buyerId, creditsToTransfer]
      );

      // Update credit issuances to new owner
      await client.query(
        `UPDATE credit_issuances SET user_id = $1 WHERE tree_id = $2`,
        [buyerId, listing.tree_id]
      );
    }

    // Complete transaction
    await client.query(
      `UPDATE tree_transactions SET completed_at = NOW() WHERE id = $1`,
      [transactionId]
    );

    // Fetch usernames for certificate
    const sellerNameResult = await client.query(
      `SELECT COALESCE(username, name, email) as username FROM users WHERE id = $1`,
      [listing.seller_user_id]
    );
    const buyerNameResult = await client.query(
      `SELECT COALESCE(username, name, email) as username FROM users WHERE id = $1`,
      [buyerId]
    );

    // Fetch tree metadata for certificate
    const treeMetaResult = await client.query(
      `SELECT metadata FROM trees WHERE id = $1`, [listing.tree_id]
    );
    const treeMetadata = treeMetaResult.rows[0]?.metadata || {};

    // Issue NFT certificates for buyer and seller
    const certs = await issueTreeCertificates(client, {
      transactionId,
      treeId: listing.tree_id,
      sellerId: listing.seller_user_id,
      buyerId,
      price: listing.price,
      creditsTransferred: creditsToTransfer,
      treeMetadata,
      sellerUsername: sellerNameResult.rows[0]?.username || 'Unknown',
      buyerUsername: buyerNameResult.rows[0]?.username || 'Unknown',
    });

    await client.query('COMMIT');

    // Fire-and-forget on-chain NFT minting (after DB commit)
    // Fetch wallet addresses for buyer and seller
    const [buyerWalletRes, sellerWalletRes] = await Promise.all([
      pool.query('SELECT wallet_address FROM users WHERE id = $1', [buyerId]),
      pool.query('SELECT wallet_address FROM users WHERE id = $1', [listing.seller_user_id]),
    ]);
    const buyerWalletAddress = buyerWalletRes.rows[0]?.wallet_address;
    const sellerWalletAddress = sellerWalletRes.rows[0]?.wallet_address;

    // Mint buyer certificate NFT (async, don't block response)
    mintCertificateNFT({
      certificateId: certs.buyerCertId,
      recipientWallet: buyerWalletAddress,
      certificateNumber: certs.buyerCertificateNumber,
      certificateHash: certs.buyerHash,
      certificateType: 'tree_purchase',
    }).catch((e) => console.error('[Blockchain] buyTree buyer mint error:', e.message));

    // Mint seller certificate NFT (async, don't block response)
    mintCertificateNFT({
      certificateId: certs.sellerCertId,
      recipientWallet: sellerWalletAddress,
      certificateNumber: certs.sellerCertificateNumber,
      certificateHash: certs.sellerHash,
      certificateType: 'tree_sale',
    }).catch((e) => console.error('[Blockchain] buyTree seller mint error:', e.message));

    console.log(`[Marketplace] User ${buyerId} bought tree ${listing.tree_id} from user ${listing.seller_user_id} for $${listing.price}`);

    return res.json({
      success: true,
      transaction: {
        id: transactionId,
        treeId: listing.tree_id,
        price: parseFloat(listing.price),
        creditsTransferred: creditsToTransfer,
      },
      certificateNumber: certs.buyerCertificateNumber,
      message: `Successfully purchased tree for $${parseFloat(listing.price).toFixed(2)}. ${creditsToTransfer.toFixed(2)} kg CO₂ credits have been transferred to your account.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("buyTree error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

/**
 * Cancel a listing
 * POST /api/marketplace/cancel/:listingId
 */
export const cancelListing = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const listingId = parseInt(req.params.listingId);
    if (!Number.isFinite(listingId)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    // Get listing
    const listingResult = await pool.query(
      `SELECT * FROM tree_listings WHERE id = $1`,
      [listingId]
    );

    if (!listingResult.rows[0]) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const listing = listingResult.rows[0];

    // Verify ownership
    if (listing.seller_user_id !== userId) {
      return res.status(403).json({ error: "You can only cancel your own listings" });
    }

    if (listing.status !== "active") {
      return res.status(400).json({ error: `Cannot cancel a ${listing.status} listing` });
    }

    // Cancel listing
    await pool.query(
      `UPDATE tree_listings SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [listingId]
    );

    console.log(`[Marketplace] User ${userId} cancelled listing ${listingId}`);

    return res.json({
      success: true,
      message: "Listing cancelled successfully",
    });
  } catch (err) {
    console.error("cancelListing error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get user's own listings
 * GET /api/marketplace/my-listings
 */
export const getMyListings = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { status } = req.query;

    let whereClause = "l.seller_user_id = $1";
    const params = [userId];

    if (status && ["active", "sold", "cancelled"].includes(status)) {
      whereClause += " AND l.status = $2";
      params.push(status);
    }

    const result = await pool.query(
      `SELECT 
        l.*,
        t.metadata as tree_metadata,
        t.carbon_absorption_kg_per_year,
        t.total_credits_accrued
      FROM tree_listings l
      JOIN trees t ON t.id = l.tree_id
      WHERE ${whereClause}
      ORDER BY l.created_at DESC`,
      params
    );

    const listings = result.rows.map(row => ({
      id: row.id,
      treeId: row.tree_id,
      price: parseFloat(row.price),
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      soldAt: row.sold_at,
      tree: {
        name: row.tree_metadata?.name || `Tree #${row.tree_id}`,
        species: row.tree_metadata?.species || "Unknown",
        absorptionRate: parseFloat(row.carbon_absorption_kg_per_year) || 0,
        totalCreditsAccrued: parseFloat(row.total_credits_accrued) || 0,
      },
    }));

    return res.json({ listings });
  } catch (err) {
    console.error("getMyListings error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get user's purchase history
 * GET /api/marketplace/my-purchases
 */
export const getMyPurchases = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const result = await pool.query(
      `SELECT 
        tx.*,
        t.metadata as tree_metadata,
        COALESCE(seller.username, seller.name, seller.email) as seller_username
      FROM tree_transactions tx
      JOIN trees t ON t.id = tx.tree_id
      JOIN users seller ON seller.id = tx.seller_user_id
      WHERE tx.buyer_user_id = $1 AND tx.status = 'completed'
      ORDER BY tx.completed_at DESC`,
      [userId]
    );

    const purchases = result.rows.map(row => ({
      id: row.id,
      treeId: row.tree_id,
      treeName: row.tree_metadata?.name || `Tree #${row.tree_id}`,
      treeSpecies: row.tree_metadata?.species || "Unknown",
      price: parseFloat(row.sale_price),
      creditsReceived: parseFloat(row.credits_transferred),
      sellerUsername: row.seller_username,
      completedAt: row.completed_at,
    }));

    return res.json({ purchases });
  } catch (err) {
    console.error("getMyPurchases error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get user's sales history
 * GET /api/marketplace/my-sales
 */
export const getMySales = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const result = await pool.query(
      `SELECT 
        tx.*,
        t.metadata as tree_metadata,
        COALESCE(buyer.username, buyer.name, buyer.email) as buyer_username
      FROM tree_transactions tx
      JOIN trees t ON t.id = tx.tree_id
      JOIN users buyer ON buyer.id = tx.buyer_user_id
      WHERE tx.seller_user_id = $1 AND tx.status = 'completed'
      ORDER BY tx.completed_at DESC`,
      [userId]
    );

    const sales = result.rows.map(row => ({
      id: row.id,
      treeId: row.tree_id,
      treeName: row.tree_metadata?.name || `Tree #${row.tree_id}`,
      treeSpecies: row.tree_metadata?.species || "Unknown",
      price: parseFloat(row.sale_price),
      creditsTransferred: parseFloat(row.credits_transferred),
      buyerUsername: row.buyer_username,
      completedAt: row.completed_at,
    }));

    return res.json({ sales });
  } catch (err) {
    console.error("getMySales error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Check if tree is eligible for listing
 * GET /api/marketplace/check-eligibility/:treeId
 */
export const checkListingEligibility = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const treeId = parseInt(req.params.treeId);
    if (!Number.isFinite(treeId)) {
      return res.status(400).json({ error: "Invalid tree ID" });
    }

    const result = await pool.query(
      `SELECT t.*, 
              (SELECT MAX(v.created_at) FROM tree_verifications v 
               WHERE v.tree_id = t.id AND v.status = 'approved') as last_verified_at,
              (SELECT COUNT(*) FROM tree_listings l 
               WHERE l.tree_id = t.id AND l.status = 'active') as active_listings
       FROM trees t 
       WHERE t.id = $1`,
      [treeId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Tree not found" });
    }

    const tree = result.rows[0];
    const issues = [];

    if (tree.owner_user_id !== userId) {
      issues.push("You do not own this tree");
    }

    if (tree.status !== "active") {
      issues.push(`Tree status is "${tree.status}" - only active trees can be listed`);
    }

    if (!isVerificationCurrent(tree.last_verified_at)) {
      const lastVerified = tree.last_verified_at 
        ? new Date(tree.last_verified_at).toLocaleDateString()
        : "Never";
      issues.push(`Verification expired. Last verified: ${lastVerified}. Please verify your tree first.`);
    }

    if (parseInt(tree.active_listings) > 0) {
      issues.push("Tree already has an active listing");
    }

    const eligible = issues.length === 0;

    return res.json({
      eligible,
      issues,
      tree: {
        id: tree.id,
        name: tree.metadata?.name || `Tree #${tree.id}`,
        species: tree.metadata?.species || "Unknown",
        status: tree.status,
        lastVerifiedAt: tree.last_verified_at,
        verificationCurrent: isVerificationCurrent(tree.last_verified_at),
      },
    });
  } catch (err) {
    console.error("checkListingEligibility error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// ============================================================
// Credit Listing Endpoints
// ============================================================

/**
 * List credits for sale
 * POST /api/marketplace/credits/list
 * Body: { amount, pricePerUnit, description? }
 */
export const listCredits = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { amount, pricePerUnit, description } = req.body;

    const numAmount = parseFloat(amount);
    const numPrice = parseFloat(pricePerUnit);

    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      return res.status(400).json({ error: "Price per unit must be a positive number" });
    }

    // Check user has enough credits
    const creditResult = await pool.query(
      `SELECT available_balance FROM carbon_credits WHERE user_id = $1`,
      [userId]
    );

    const available = parseFloat(creditResult.rows[0]?.available_balance) || 0;

    // Also check credits already locked in active listings
    const lockedResult = await pool.query(
      `SELECT COALESCE(SUM(remaining_amount), 0) as locked
       FROM credit_listings WHERE seller_user_id = $1 AND status IN ('active', 'partially_sold')`,
      [userId]
    );
    const locked = parseFloat(lockedResult.rows[0]?.locked) || 0;

    if (numAmount > available - locked) {
      return res.status(400).json({
        error: `Insufficient credits. Available: ${(available - locked).toFixed(2)} kg CO₂ (${available.toFixed(2)} total, ${locked.toFixed(2)} in active listings)`,
      });
    }

    const totalPrice = numAmount * numPrice;

    const result = await pool.query(
      `INSERT INTO credit_listings (seller_user_id, amount, price_per_unit, total_price, remaining_amount, description)
       VALUES ($1, $2, $3, $4, $2, $5)
       RETURNING *`,
      [userId, numAmount, numPrice, totalPrice, description || null]
    );

    const listing = result.rows[0];

    console.log(`[Marketplace] User ${userId} listed ${numAmount} credits at $${numPrice}/unit`);

    return res.status(201).json({
      listing: {
        id: listing.id,
        amount: parseFloat(listing.amount),
        remainingAmount: parseFloat(listing.remaining_amount),
        pricePerUnit: parseFloat(listing.price_per_unit),
        totalPrice: parseFloat(listing.total_price),
        description: listing.description,
        status: listing.status,
        createdAt: listing.created_at,
      },
      message: `Listed ${numAmount.toFixed(2)} kg CO₂ credits for sale at $${numPrice.toFixed(2)}/unit`,
    });
  } catch (err) {
    console.error("listCredits error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get all active credit listings
 * GET /api/marketplace/credits/listings
 */
export const getCreditListings = async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      limit = 20,
      offset = 0,
      minPrice,
      maxPrice,
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;

    let whereClause = "cl.status IN ('active', 'partially_sold') AND cl.remaining_amount > 0";
    const params = [];
    let paramIndex = 1;

    if (minPrice !== undefined) {
      whereClause += ` AND cl.price_per_unit >= $${paramIndex++}`;
      params.push(parseFloat(minPrice));
    }
    if (maxPrice !== undefined) {
      whereClause += ` AND cl.price_per_unit <= $${paramIndex++}`;
      params.push(parseFloat(maxPrice));
    }

    const validSorts = ["created_at", "price_per_unit", "remaining_amount"];
    const validOrders = ["asc", "desc"];
    const sortColumn = validSorts.includes(sortBy) ? sortBy : "created_at";
    const order = validOrders.includes(sortOrder?.toLowerCase()) ? sortOrder : "desc";

    const query = `
      SELECT
        cl.*,
        COALESCE(u.username, u.name, u.email) as seller_username
      FROM credit_listings cl
      JOIN users u ON u.id = cl.seller_user_id
      WHERE ${whereClause}
      ORDER BY cl.${sortColumn} ${order}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    const countQuery = `SELECT COUNT(*) as total FROM credit_listings cl WHERE ${whereClause}`;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.total) || 0;

    const listings = result.rows.map((row) => ({
      id: row.id,
      amount: parseFloat(row.amount),
      remainingAmount: parseFloat(row.remaining_amount),
      pricePerUnit: parseFloat(row.price_per_unit),
      totalPrice: parseFloat(row.total_price),
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      isOwn: row.seller_user_id === userId,
      seller: {
        id: row.seller_user_id,
        username: row.seller_username,
      },
    }));

    return res.json({
      listings,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset), hasMore: parseInt(offset) + listings.length < total },
    });
  } catch (err) {
    console.error("getCreditListings error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Buy credits from a listing
 * POST /api/marketplace/credits/buy/:listingId
 * Body: { amount }
 */
export const buyCredits = async (req, res) => {
  const client = await pool.connect();
  try {
    const buyerId = req.user?.id;
    if (!buyerId) return res.status(401).json({ error: "Not authenticated" });

    const listingId = parseInt(req.params.listingId);
    if (!Number.isFinite(listingId)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const numAmount = parseFloat(req.body.amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    await client.query("BEGIN");

    // Lock the listing
    const listingResult = await client.query(
      `SELECT * FROM credit_listings WHERE id = $1 FOR UPDATE`,
      [listingId]
    );

    if (!listingResult.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Listing not found" });
    }

    const listing = listingResult.rows[0];

    if (!["active", "partially_sold"].includes(listing.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Listing is no longer active" });
    }

    if (listing.seller_user_id === buyerId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot buy your own credits" });
    }

    const remaining = parseFloat(listing.remaining_amount);
    const purchaseAmount = Math.min(numAmount, remaining);

    if (purchaseAmount <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No credits remaining in this listing" });
    }

    const pricePerUnit = parseFloat(listing.price_per_unit);
    const totalCost = purchaseAmount * pricePerUnit;
    const newRemaining = remaining - purchaseAmount;

    // Create credit transaction record
    const ctxResult = await client.query(
      `INSERT INTO credit_transactions (listing_id, seller_user_id, buyer_user_id, amount, price_per_unit, total_price, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', NOW())
       RETURNING id`,
      [listingId, listing.seller_user_id, buyerId, purchaseAmount, pricePerUnit, totalCost]
    );
    const creditTransactionId = ctxResult.rows[0].id;

    // Update listing remaining
    const newStatus = newRemaining <= 0 ? "sold" : "partially_sold";
    await client.query(
      `UPDATE credit_listings SET remaining_amount = $1, status = $2, updated_at = NOW()${newRemaining <= 0 ? ", sold_at = NOW()" : ""} WHERE id = $3`,
      [newRemaining, newStatus, listingId]
    );

    // Transfer credits: deduct from seller
    await client.query(
      `UPDATE carbon_credits
       SET available_balance = GREATEST(0, available_balance - $1),
           total_transferred_out = total_transferred_out + $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [purchaseAmount, listing.seller_user_id]
    );

    // Transfer credits: add to buyer
    await client.query(
      `INSERT INTO carbon_credits (user_id, available_balance, total_transferred_in)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         available_balance = carbon_credits.available_balance + $2,
         total_transferred_in = carbon_credits.total_transferred_in + $2,
         updated_at = NOW()`,
      [buyerId, purchaseAmount]
    );

    // Record in credit_transfers for history
    await client.query(
      `INSERT INTO credit_transfers (from_user_id, to_user_id, amount, transfer_type)
       VALUES ($1, $2, $3, 'market_sale')`,
      [listing.seller_user_id, buyerId, purchaseAmount]
    );

    // Fetch usernames for certificate
    const cSellerName = await client.query(
      `SELECT COALESCE(username, name, email) as username FROM users WHERE id = $1`,
      [listing.seller_user_id]
    );
    const cBuyerName = await client.query(
      `SELECT COALESCE(username, name, email) as username FROM users WHERE id = $1`,
      [buyerId]
    );

    // Issue NFT certificates for buyer and seller
    const creditCerts = await issueCreditCertificates(client, {
      creditTransactionId,
      sellerId: listing.seller_user_id,
      buyerId,
      amount: purchaseAmount,
      pricePerUnit,
      totalPrice: totalCost,
      sellerUsername: cSellerName.rows[0]?.username || 'Unknown',
      buyerUsername: cBuyerName.rows[0]?.username || 'Unknown',
    });

    await client.query("COMMIT");

    // Fire-and-forget on-chain NFT minting (after DB commit)
    const [cbuyerWalletRes, csellerWalletRes] = await Promise.all([
      pool.query('SELECT wallet_address FROM users WHERE id = $1', [buyerId]),
      pool.query('SELECT wallet_address FROM users WHERE id = $1', [listing.seller_user_id]),
    ]);

    mintCertificateNFT({
      certificateId: creditCerts.buyerCertId,
      recipientWallet: cbuyerWalletRes.rows[0]?.wallet_address,
      certificateNumber: creditCerts.buyerCertificateNumber,
      certificateHash: creditCerts.buyerHash,
      certificateType: 'credit_purchase',
    }).catch((e) => console.error('[Blockchain] buyCredits buyer mint error:', e.message));

    mintCertificateNFT({
      certificateId: creditCerts.sellerCertId,
      recipientWallet: csellerWalletRes.rows[0]?.wallet_address,
      certificateNumber: creditCerts.sellerCertificateNumber,
      certificateHash: creditCerts.sellerHash,
      certificateType: 'credit_sale',
    }).catch((e) => console.error('[Blockchain] buyCredits seller mint error:', e.message));

    console.log(`[Marketplace] User ${buyerId} bought ${purchaseAmount} credits from listing ${listingId}`);

    return res.json({
      success: true,
      transaction: {
        listingId,
        amount: purchaseAmount,
        pricePerUnit,
        totalCost,
      },
      certificateNumber: creditCerts.buyerCertificateNumber,
      message: `Successfully purchased ${purchaseAmount.toFixed(2)} kg CO₂ credits for $${totalCost.toFixed(2)}`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("buyCredits error:", err);
    return res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
};

/**
 * Cancel a credit listing
 * POST /api/marketplace/credits/cancel/:listingId
 */
export const cancelCreditListing = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const listingId = parseInt(req.params.listingId);
    if (!Number.isFinite(listingId)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const listingResult = await pool.query(
      `SELECT * FROM credit_listings WHERE id = $1`,
      [listingId]
    );

    if (!listingResult.rows[0]) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const listing = listingResult.rows[0];

    if (listing.seller_user_id !== userId) {
      return res.status(403).json({ error: "You can only cancel your own listings" });
    }

    if (!["active", "partially_sold"].includes(listing.status)) {
      return res.status(400).json({ error: `Cannot cancel a ${listing.status} listing` });
    }

    await pool.query(
      `UPDATE credit_listings SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [listingId]
    );

    console.log(`[Marketplace] User ${userId} cancelled credit listing ${listingId}`);

    return res.json({ success: true, message: "Credit listing cancelled successfully" });
  } catch (err) {
    console.error("cancelCreditListing error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get user's credit listings
 * GET /api/marketplace/credits/my-listings
 */
export const getMyCreditListings = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const result = await pool.query(
      `SELECT * FROM credit_listings WHERE seller_user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const listings = result.rows.map((row) => ({
      id: row.id,
      amount: parseFloat(row.amount),
      remainingAmount: parseFloat(row.remaining_amount),
      pricePerUnit: parseFloat(row.price_per_unit),
      totalPrice: parseFloat(row.total_price),
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      soldAt: row.sold_at,
    }));

    return res.json({ listings });
  } catch (err) {
    console.error("getMyCreditListings error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// ============================================================
// Unified Transactions Endpoint
// ============================================================

/**
 * Get all user transactions (tree purchases, tree sales, credit purchases, credit sales, credit transfers)
 * GET /api/marketplace/transactions
 * Query: { limit?, offset? }
 */
export const getTransactions = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { limit = 50, offset = 0 } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 100);
    const off = parseInt(offset) || 0;

    // Tree purchases
    const treePurchases = await pool.query(
      `SELECT 
        'tree_purchase' as type,
        tx.id,
        tx.tree_id,
        tx.sale_price as amount,
        tx.credits_transferred,
        tx.completed_at as date,
        t.metadata as tree_metadata,
        COALESCE(seller.username, seller.name, seller.email) as counterparty
       FROM tree_transactions tx
       JOIN trees t ON t.id = tx.tree_id
       JOIN users seller ON seller.id = tx.seller_user_id
       WHERE tx.buyer_user_id = $1 AND tx.status = 'completed'`,
      [userId]
    );

    // Tree sales
    const treeSales = await pool.query(
      `SELECT 
        'tree_sale' as type,
        tx.id,
        tx.tree_id,
        tx.sale_price as amount,
        tx.credits_transferred,
        tx.completed_at as date,
        t.metadata as tree_metadata,
        COALESCE(buyer.username, buyer.name, buyer.email) as counterparty
       FROM tree_transactions tx
       JOIN trees t ON t.id = tx.tree_id
       JOIN users buyer ON buyer.id = tx.buyer_user_id
       WHERE tx.seller_user_id = $1 AND tx.status = 'completed'`,
      [userId]
    );

    // Credit purchases (from marketplace)
    const creditPurchases = await pool.query(
      `SELECT 
        'credit_purchase' as type,
        ct.id,
        ct.amount,
        ct.total_price,
        ct.price_per_unit,
        ct.completed_at as date,
        COALESCE(seller.username, seller.name, seller.email) as counterparty
       FROM credit_transactions ct
       JOIN users seller ON seller.id = ct.seller_user_id
       WHERE ct.buyer_user_id = $1 AND ct.status = 'completed'`,
      [userId]
    );

    // Credit sales (from marketplace)
    const creditSales = await pool.query(
      `SELECT 
        'credit_sale' as type,
        ct.id,
        ct.amount,
        ct.total_price,
        ct.price_per_unit,
        ct.completed_at as date,
        COALESCE(buyer.username, buyer.name, buyer.email) as counterparty
       FROM credit_transactions ct
       JOIN users buyer ON buyer.id = ct.buyer_user_id
       WHERE ct.seller_user_id = $1 AND ct.status = 'completed'`,
      [userId]
    );

    // Direct credit transfers (sent)
    const transfersSent = await pool.query(
      `SELECT 
        'credit_transfer_out' as type,
        ct.id,
        ct.amount,
        ct.memo,
        ct.created_at as date,
        COALESCE(receiver.username, receiver.name, receiver.email) as counterparty
       FROM credit_transfers ct
       JOIN users receiver ON receiver.id = ct.to_user_id
       WHERE ct.from_user_id = $1 AND ct.transfer_type IN ('manual', 'gift')`,
      [userId]
    );

    // Direct credit transfers (received)
    const transfersReceived = await pool.query(
      `SELECT 
        'credit_transfer_in' as type,
        ct.id,
        ct.amount,
        ct.memo,
        ct.created_at as date,
        COALESCE(sender.username, sender.name, sender.email) as counterparty
       FROM credit_transfers ct
       JOIN users sender ON sender.id = ct.from_user_id
       WHERE ct.to_user_id = $1 AND ct.transfer_type IN ('manual', 'gift')`,
      [userId]
    );

    // Combine and sort
    const allTransactions = [
      ...treePurchases.rows.map((r) => ({
        type: r.type,
        id: r.id,
        description: `Purchased tree "${r.tree_metadata?.name || `Tree #${r.tree_id}`}"`,
        amount: parseFloat(r.amount),
        creditsTransferred: parseFloat(r.credits_transferred) || 0,
        counterparty: r.counterparty,
        date: r.date,
      })),
      ...treeSales.rows.map((r) => ({
        type: r.type,
        id: r.id,
        description: `Sold tree "${r.tree_metadata?.name || `Tree #${r.tree_id}`}"`,
        amount: parseFloat(r.amount),
        creditsTransferred: parseFloat(r.credits_transferred) || 0,
        counterparty: r.counterparty,
        date: r.date,
      })),
      ...creditPurchases.rows.map((r) => ({
        type: r.type,
        id: r.id,
        description: `Purchased ${parseFloat(r.amount).toFixed(2)} kg CO₂ credits`,
        amount: parseFloat(r.total_price),
        creditsAmount: parseFloat(r.amount),
        pricePerUnit: parseFloat(r.price_per_unit),
        counterparty: r.counterparty,
        date: r.date,
      })),
      ...creditSales.rows.map((r) => ({
        type: r.type,
        id: r.id,
        description: `Sold ${parseFloat(r.amount).toFixed(2)} kg CO₂ credits`,
        amount: parseFloat(r.total_price),
        creditsAmount: parseFloat(r.amount),
        pricePerUnit: parseFloat(r.price_per_unit),
        counterparty: r.counterparty,
        date: r.date,
      })),
      ...transfersSent.rows.map((r) => ({
        type: r.type,
        id: r.id,
        description: `Transferred ${parseFloat(r.amount).toFixed(2)} kg CO₂ to ${r.counterparty}`,
        amount: parseFloat(r.amount),
        counterparty: r.counterparty,
        memo: r.memo,
        date: r.date,
      })),
      ...transfersReceived.rows.map((r) => ({
        type: r.type,
        id: r.id,
        description: `Received ${parseFloat(r.amount).toFixed(2)} kg CO₂ from ${r.counterparty}`,
        amount: parseFloat(r.amount),
        counterparty: r.counterparty,
        memo: r.memo,
        date: r.date,
      })),
    ];

    // Sort by date descending
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Attach certificate numbers to transactions that have them
    const treeTransactionIds = allTransactions
      .filter((t) => t.type === "tree_purchase" || t.type === "tree_sale")
      .map((t) => t.id);
    const creditTransactionIds = allTransactions
      .filter((t) => t.type === "credit_purchase" || t.type === "credit_sale")
      .map((t) => t.id);

    let certMap = {};

    if (treeTransactionIds.length > 0) {
      const certRows = await pool.query(
        `SELECT tree_transaction_id, certificate_number, certificate_type
         FROM certificates
         WHERE tree_transaction_id = ANY($1) AND recipient_user_id = $2`,
        [treeTransactionIds, userId]
      );
      for (const row of certRows.rows) {
        certMap[`${row.certificate_type}-${row.tree_transaction_id}`] = row.certificate_number;
      }
    }
    if (creditTransactionIds.length > 0) {
      const certRows = await pool.query(
        `SELECT credit_transaction_id, certificate_number, certificate_type
         FROM certificates
         WHERE credit_transaction_id = ANY($1) AND recipient_user_id = $2`,
        [creditTransactionIds, userId]
      );
      for (const row of certRows.rows) {
        certMap[`${row.certificate_type}-${row.credit_transaction_id}`] = row.certificate_number;
      }
    }

    // Attach certificate numbers
    for (const tx of allTransactions) {
      tx.certificateNumber = certMap[`${tx.type}-${tx.id}`] || null;
    }

    const total = allTransactions.length;
    const paged = allTransactions.slice(off, off + lim);

    return res.json({
      transactions: paged,
      pagination: {
        total,
        limit: lim,
        offset: off,
        hasMore: off + paged.length < total,
      },
    });
  } catch (err) {
    console.error("getTransactions error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// ============================================================
// Certificate Endpoints
// ============================================================

/**
 * Get all certificates for authenticated user
 * GET /api/marketplace/certificates
 */
export const getCertificates = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { limit = 50, offset = 0 } = req.query;
    const { certificates, total } = await getUserCertificates(userId, {
      limit: Math.min(parseInt(limit) || 50, 100),
      offset: parseInt(offset) || 0,
    });

    return res.json({
      certificates: certificates.map(formatCertificate),
      pagination: {
        total,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
        hasMore: (parseInt(offset) || 0) + certificates.length < total,
      },
    });
  } catch (err) {
    console.error("getCertificates error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Get a single certificate by number
 * GET /api/marketplace/certificates/:certificateNumber
 */
export const getCertificate = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { certificateNumber } = req.params;
    if (!certificateNumber) {
      return res.status(400).json({ error: "Certificate number required" });
    }

    const row = await getCertificateByNumber(certificateNumber, userId);

    if (!row) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    return res.json({ certificate: formatCertificate(row) });
  } catch (err) {
    console.error("getCertificate error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

export default {
  listTree,
  getListings,
  getListingDetail,
  buyTree,
  cancelListing,
  getMyListings,
  getMyPurchases,
  getMySales,
  checkListingEligibility,
  listCredits,
  getCreditListings,
  buyCredits,
  cancelCreditListing,
  getMyCreditListings,
  getTransactions,
  getCertificates,
  getCertificate,
};
