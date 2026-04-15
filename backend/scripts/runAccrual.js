import dotenv from "dotenv";
import { triggerManualAccrual } from "../services/creditAccrual.js";

// Load environment variables from .env
dotenv.config();

async function main() {
  try {
    console.log("[RunAccrual] Starting manual credit accrual run...");
    await triggerManualAccrual();
    console.log("[RunAccrual] Manual credit accrual completed.");
    process.exit(0);
  } catch (err) {
    console.error("[RunAccrual] Error during manual accrual:", err);
    process.exit(1);
  }
}

main();
