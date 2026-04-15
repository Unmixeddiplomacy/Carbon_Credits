import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { overview } from "../controller/analytics.controller.js";

const router = express.Router();

router.use(protect);

router.get("/overview", overview);

export default router;
