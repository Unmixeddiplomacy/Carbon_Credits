import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
	create_metadata,
	metadata,
	register_callback,
	list_trees,
	tree_detail,
} from "../controller/trees.controller.js";

const router = express.Router();

// User's trees (requires auth)
router.get("/", protect, list_trees);
router.get("/:id", protect, tree_detail);

// Authenticated metadata + callback endpoints
router.post("/create-metadata", protect, create_metadata);
router.get("/:id/metadata", protect, metadata);
router.post("/register-callback", protect, register_callback);

export default router;
