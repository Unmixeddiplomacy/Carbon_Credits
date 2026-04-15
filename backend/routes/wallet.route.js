import express from 'express';
import { request_link, unlink, verify_link } from '../controller/wallet.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post("/request-link",protect, request_link);
router.post("/verify-link",protect, verify_link);
router.post("/unlink",protect, unlink);

export default router;