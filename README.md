# Carbon Credit Platform

Full‑stack demo platform for registering trees, linking wallets, accruing carbon credits, and (optionally) issuing them on‑chain.

This repo has two apps:
- **backend/** – Node/Express API, PostgreSQL, cron for daily credit accrual, Hardhat contracts
- **frontend/** – React + Vite SPA

---

## 1. Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- PostgreSQL 13+ running locally or remotely
- (Optional) Metamask + local Hardhat node if you want to interact with the smart contract

---

## 2. Environment configuration

Create a `.env` file inside **backend/** with at least:

```env
# API
PORT=3000
CLIENT_URL=http://localhost:5173

# Postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=carbon_credit
DB_USER=postgres
DB_PASSWORD=postgres

# Auth
JWT_SECRET=change_me

# Cron / credit accrual
# Turn on automatic daily accrual when the server starts
ENABLE_CRON=true

# Optional: other keys (RPC URL, private keys, etc.) if you wire real on‑chain issuance
```

Adjust values to match your local Postgres setup.

> If you already have a `.env` file, just ensure these keys are present and correct.

---

## 3. Database setup

1. Create the database in Postgres (example):
   ```sql
   CREATE DATABASE carbon_credit;
   ```

2. Apply the SQL migrations in **backend/migrations/** in order (001, 002, 003, etc.).
   - You can run each file manually in your SQL client (psql, DBeaver, etc.).
   - Example with psql:
     ```bash
     psql -h localhost -U postgres -d carbon_credit -f backend/migrations/001_initial.sql
     psql -h localhost -U postgres -d carbon_credit -f backend/migrations/002_carbon_credits.sql
     psql -h localhost -U postgres -d carbon_credit -f backend/migrations/003_verification_system.sql
     ```

After this, the tables for users, trees, verifications, credits, etc. will be ready.

---

## 4. Local blockchain & contracts (Hardhat)

If you want to use the on‑chain features locally, run a Hardhat node and deploy the contracts.

1. **Start the local Hardhat node** (new terminal):
   ```bash
   cd backend
   npx hardhat node
   ```
   Keep this terminal running. The node listens on `http://127.0.0.1:8545`.

2. **Deploy contracts to the local node** (second terminal):
   ```bash
   cd backend
   npm run deploy:localhost
   ```

   This will:
   - Deploy `TreeRegistry` and `CarbonCredit` to the local network
   - Save ABIs and addresses to `backend/deployed/`
   - Copy the same ABIs and addresses into `frontend/src/contracts/`

3. **When to re‑deploy**
   - Any time you **restart the Hardhat node**, all state is reset.
   - After every restart, run the deploy script again **before** using the app so the addresses match the fresh chain.

> If you only want to test the REST API and database (no blockchain calls), you can skip this section.

---

## 4b. Persistent testnet (Sepolia) – recommended for stable dev

Using Sepolia means the chain never resets, so your DB and on‑chain state stay aligned across restarts.

### One‑time setup

1. **Get Sepolia ETH** (for gas):
   - Create a wallet in MetaMask
   - Get free Sepolia ETH from a faucet:
     - https://sepoliafaucet.com
     - https://www.alchemy.com/faucets/ethereum-sepolia

2. **Get a Sepolia RPC URL**:
   - Sign up at [Alchemy](https://alchemy.com) or [Infura](https://infura.io)
   - Create a new app for Sepolia
   - Copy the HTTPS endpoint (e.g. `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`)

3. **Add to `backend/.env`**:
   ```env
   # Sepolia testnet
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   DEPLOYER_PRIVATE_KEY=0xYOUR_WALLET_PRIVATE_KEY

   # Point backend RPC to Sepolia (instead of localhost)
   RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   
   # Oracle key = same as deployer for Sepolia
   ORACLE_PRIVATE_KEY=0xYOUR_WALLET_PRIVATE_KEY
   ```

   > **Security**: Never commit real private keys. Use a dedicated dev wallet with only testnet ETH.

4. **Deploy contracts to Sepolia** (only once, or when contracts change):
   ```bash
   cd backend
   npm run deploy:sepolia
   ```

   This deploys to the persistent Sepolia chain and saves the addresses. You **don't** re-deploy on every restart.

### Daily workflow with Sepolia

Since Sepolia persists, you just:
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Use the app – trees registered will stay on-chain permanently.
4. Run accrual anytime: `cd backend && npm run run:accrual`

No need to re-deploy or reset data.

### Add Sepolia to MetaMask

- Network Name: `Sepolia`
- RPC URL: Your Alchemy/Infura URL (or `https://rpc.sepolia.org`)
- Chain ID: `11155111`
- Currency: `SepoliaETH`
- Explorer: `https://sepolia.etherscan.io`

---

## 5. Fresh start (reset DB + redeploy)

If you switch networks or want a completely clean slate:

### Option A: Keep users, reset trees/credits only
```bash
cd backend
npm run reset:trees
```

### Option B: Full reset (users + trees + credits)
```bash
cd backend
npm run reset:all
```

### Then redeploy contracts:
```bash
# For localhost (ephemeral)
npm run deploy:localhost

# OR for Sepolia (persistent)
npm run deploy:sepolia
```

### Summary of npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start backend with nodemon |
| `npm run deploy:localhost` | Deploy contracts to local Hardhat |
| `npm run deploy:sepolia` | Deploy contracts to Sepolia testnet |
| `npm run reset:trees` | Clear trees/credits (keep users) |
| `npm run reset:all` | Clear everything including users |
| `npm run run:accrual` | Manually trigger credit accrual |
| `npm run compile` | Compile Solidity contracts |

---

## 6. Install dependencies

From the project root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

---

## 7. Running the app in development

### 7.1 Start the backend API

In **backend/**:

```bash
cd backend
npm run dev   # or: npm start
```

- The API will run on `http://localhost:3000` by default.
- If `ENABLE_CRON=true` in your `.env`, the daily credit accrual cron job will start automatically when the server boots.

### 7.2 Start the frontend (Vite + React)

In **frontend/**:

```bash
cd frontend
npm run dev
```

- Vite will usually start on `http://localhost:5173`.
- This URL must match `CLIENT_URL` in `backend/.env` for CORS and cookies to work.

Open the browser at `http://localhost:5173` and use the app.

---

## 8. Manual credit accrual (for testing)

You can manually run the credit accrual logic for all active trees, without waiting for the cron job.

In **backend/**:

```bash
cd backend
node scripts/runAccrual.js
# or, if you prefer npm scripts
npm run run:accrual
```

This will:
- Connect to the database
- Find all active trees with a configured absorption rate
- Accrue credits up to today
- Queue any pending issuances (if on‑chain is enabled)

Logs are printed to the console for debugging.

---

## 9. Typical dev workflow

1. Start Postgres and ensure the `carbon_credit` DB exists.
2. Apply migrations in `backend/migrations/` if schema changed.
3. Ensure `backend/.env` is configured.
4. (If using Sepolia) Deploy contracts once: `npm run deploy:sepolia`
5. Run backend: `npm run dev` inside `backend/`.
6. Run frontend: `npm run dev` inside `frontend/`.
7. Register a user, link a wallet, and register trees from the UI.
8. Run accrual anytime: `npm run run:accrual` in `backend/`.

---

## 10. Production notes (high‑level)

- Use a managed Postgres instance and secure credentials.
- Run the backend behind a reverse proxy (Nginx, etc.) and serve the frontend build from a static host.
- Make sure JWT secrets and any blockchain private keys are never committed; keep them only in environment variables or a secrets manager.
- Keep `ENABLE_CRON` enabled only on a single backend instance to avoid duplicate accrual runs.
