import express from 'express';
import { login, logout, register, me } from '../controller/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Return the currently authenticated user based on the JWT cookie
router.get('/me', protect, me);

export default router;