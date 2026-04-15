import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser";
import cors from 'cors';
import authRoutes from "./routes/auth.route.js"
import walletRoutes from "./routes/wallet.route.js"
import treesRoutes from "./routes/trees.route.js"
import creditsRoutes from "./routes/credits.route.js"
import verificationRoutes from "./routes/verification.route.js"
import marketplaceRoutes from "./routes/marketplace.route.js"
import adminRoutes from "./routes/admin.route.js"
import analyticsRoutes from "./routes/analytics.route.js"
import { runCreditAccrual, startCronScheduler } from "./services/creditAccrual.js"
import { ensureDeployed, retryPendingMints } from "./services/blockchain.service.js"
import { ensureAdminUser } from "./services/adminSeed.service.js";

dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
}))
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth' , authRoutes);
app.use('/api/wallet' , walletRoutes);
app.use('/api/trees' , treesRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);

const PORT = process.env.PORT || 3000;

// Ensure the admin account exists (idempotent).
try {
    const result = await ensureAdminUser();
    if (result?.created) {
        console.log("[Admin] Seeded admin user: admin@gmail.com");
    }
} catch (err) {
    console.error("[Admin] Failed to seed admin user:", err?.message || err);
}

// Always reconcile once on startup so credits are up to date.
setTimeout(() => {
    runCreditAccrual().catch((err) => console.error("[Credits] Startup reconcile error:", err));
}, 1000);

// Auto-deploy CertificateNFT if needed, then retry pending mints
setTimeout(async () => {
    try {
        await ensureDeployed();
        await retryPendingMints();
    } catch (err) {
        console.error("[Blockchain] Startup error:", err);
    }
}, 3000);

// Optional: scheduled reconciliation (daily) if explicitly enabled
if (process.env.ENABLE_CRON === 'true') {
    startCronScheduler();
}

app.listen(PORT , () => {
    console.log(`Server is running on port ${PORT}`)
})