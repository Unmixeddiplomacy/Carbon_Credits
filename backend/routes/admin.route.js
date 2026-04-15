import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { listTransactions, listTrees, listUsers, overview } from "../controller/admin.controller.js";

const router = express.Router();

router.use(protect);
router.use(requireAdmin);

router.get("/overview", overview);
router.get("/users", listUsers);
router.get("/trees", listTrees);
router.get("/transactions", listTransactions);

export default router;
