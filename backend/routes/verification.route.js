import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  submitVerification,
  reportTreeDeath,
  getTreeVerifications,
  getPendingVerifications,
  reviewVerification,
  getMyVerifications,
  getDeadTrees,
} from "../controller/verification.controller.js";

const router = Router();

// All routes require authentication
router.use(protect);

// User routes
router.post("/", submitVerification);
router.post("/report-death", reportTreeDeath);
router.get("/my", getMyVerifications);
router.get("/dead-trees", getDeadTrees);
router.get("/tree/:treeId", getTreeVerifications);

// Admin routes (add admin check in controller for production)
router.get("/pending", getPendingVerifications);
router.post("/:id/review", reviewVerification);

export default router;
