import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

export const protect = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "Not authorised, no token" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await pool.query(
            "SELECT id, name, email, role, wallet_address AS \"walletAddress\" FROM users WHERE id = $1",
            [decoded.id]
        );

        if (user.rows.length === 0) {
            return res.status(401).json({ message: "Not authorised, no token" });
        }

        req.user = user.rows[0];
        next();
    } catch (error) {
        console.log("Error in auth middleware", error.message);
        // Invalid/expired token should be treated as unauthorised
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Not authorised, token invalid" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
};