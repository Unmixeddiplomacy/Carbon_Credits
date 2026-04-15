/**
 * Marketplace Routes
 * 
 * Endpoints for tree and credit marketplace functionality
 */

import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
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
} from "../controller/marketplace.controller.js";

const router = Router();

// ============================================================
// Tree Marketplace
// ============================================================

// Get all active listings (marketplace browse)
router.get("/listings", protect, getListings);

// Get single listing detail
router.get("/listings/:id", protect, getListingDetail);

// List a tree for sale
router.post("/list", protect, listTree);

// Buy a tree
router.post("/buy/:listingId", protect, buyTree);

// Cancel a listing
router.post("/cancel/:listingId", protect, cancelListing);

// Check if tree is eligible for listing
router.get("/check-eligibility/:treeId", protect, checkListingEligibility);

// ============================================================
// Credit Marketplace
// ============================================================

// Get all active credit listings
router.get("/credits/listings", protect, getCreditListings);

// List credits for sale
router.post("/credits/list", protect, listCredits);

// Buy credits from a listing
router.post("/credits/buy/:listingId", protect, buyCredits);

// Cancel a credit listing
router.post("/credits/cancel/:listingId", protect, cancelCreditListing);

// User's own credit listings
router.get("/credits/my-listings", protect, getMyCreditListings);

// ============================================================
// User's Own Data
// ============================================================

// Get user's listings
router.get("/my-listings", protect, getMyListings);

// Get user's purchase history
router.get("/my-purchases", protect, getMyPurchases);

// Get user's sales history
router.get("/my-sales", protect, getMySales);

// ============================================================
// Unified Transactions
// ============================================================
router.get("/transactions", protect, getTransactions);

// ============================================================
// Certificates
// ============================================================
router.get("/certificates", protect, getCertificates);
router.get("/certificates/:certificateNumber", protect, getCertificate);

export default router;
