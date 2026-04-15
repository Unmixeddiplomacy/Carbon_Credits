import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getCredits,
  getEligibleTrees,
  issueCredits,
  retireCredits,
  transferCredits,
  getHistory,
  getRetirements,
  getContractInfo,
  getAccrualStatus,
  getSlashHistory,
  triggerAccrual,
  getAccrualLogs,
} from "../controller/credits.controller.js";

const router = express.Router();

// All credit routes require authentication
router.use(protect);

// Get current user's credit summary
router.get("/", getCredits);

// Get trees eligible for credit issuance
router.get("/eligible-trees", getEligibleTrees);

// Get accrual status for user's trees (cron system)
router.get("/accrual-status", getAccrualStatus);

// Get slashed credits history
router.get("/slash-history", getSlashHistory);

// Get accrual job logs (admin/debug)
router.get("/accrual-logs", getAccrualLogs);

// Issue credits for a tree (deprecated - now done by cron)
router.post("/issue", issueCredits);

// Manually trigger credit accrual (admin/testing)
router.post("/trigger-accrual", triggerAccrual);

// Alternate manual trigger route for development tooling
// POST /api/credits/run-accrual
router.post("/run-accrual", triggerAccrual);

// Retire credits (burn for carbon offset)
router.post("/retire", retireCredits);

// Transfer credits to another user
router.post("/transfer", transferCredits);

// Get transaction history
router.get("/history", getHistory);

// Get retirement certificates
router.get("/retirements", getRetirements);

// Get contract deployment info
router.get("/contract-info", getContractInfo);

export default router;
