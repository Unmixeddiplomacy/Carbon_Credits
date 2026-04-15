/**
 * Blockchain Service — CertificateNFT on-chain minting
 *
 * Connects to the configured EVM network and mints soul-bound ERC-721 NFTs
 * via the CertificateNFT contract.  The backend wallet (DEPLOYER_PRIVATE_KEY)
 * must be the contract owner.
 *
 * Design:
 * - mintCertificateNFT() is fire-and-forget from the marketplace flow:
 *   the DB cert is created first (source of truth), then the on-chain mint
 *   runs asynchronously and updates DB on success/failure.
 * - retryPendingMints() is called on server start and periodically to pick
 *   up any certs stuck in 'pending' status.
 */

import { ethers } from "ethers";
import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Configuration ────────────────────────────────────────
const CERT_TYPE_MAP = {
  tree_purchase: 1,
  tree_sale: 2,
  credit_purchase: 3,
  credit_sale: 4,
};

let provider = null;
let signer = null;
let certContract = null;
let chainId = null;
let contractAddress = null;
let initialized = false;

// ── Paths ────────────────────────────────────────────
const deployedDir  = join(__dirname, "..", "deployed");
const frontendDir  = join(__dirname, "..", "..", "frontend", "src", "contracts");
const addrPath     = join(deployedDir, "CertificateNFT-address.json");
const abiPath      = join(deployedDir, "CertificateNFT-abi.json");
const artifactPath = join(__dirname, "..", "artifacts", "contracts", "CertificateNFT.sol", "CertificateNFT.json");

function getRpcAndKey() {
  const rpcUrl =
    process.env.RPC_URL ||
    process.env.BLOCKCHAIN_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    process.env.HARDHAT_RPC_URL ||
    "http://127.0.0.1:8545";
  const privKey =
    process.env.DEPLOYER_PRIVATE_KEY || process.env.ORACLE_PRIVATE_KEY;
  return { rpcUrl, privKey };
}

/**
 * Lazy-init: read deployed artifacts + env to set up ethers provider/contract.
 * Returns false if blockchain is not configured (graceful degradation).
 */
function init() {
  if (initialized) return !!certContract;

  initialized = true;

  try {
    const { rpcUrl, privKey } = getRpcAndKey();

    if (!privKey) {
      console.warn("[Blockchain] No DEPLOYER_PRIVATE_KEY set — on-chain minting disabled.");
      return false;
    }

    if (!fs.existsSync(addrPath) || !fs.existsSync(abiPath)) {
      console.warn("[Blockchain] CertificateNFT not deployed yet — will auto-deploy on startup.");
      return false;
    }

    const { address } = JSON.parse(fs.readFileSync(addrPath, "utf8"));
    const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));

    contractAddress = address;

    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    signer = new ethers.Wallet(privKey, provider);
    certContract = new ethers.Contract(contractAddress, abi, signer);

    // Detect chain ID asynchronously
    provider.getNetwork().then((net) => {
      chainId = net.chainId;
      console.log(`[Blockchain] CertificateNFT ready on chain ${chainId} at ${contractAddress}`);
    });

    return true;
  } catch (err) {
    console.error("[Blockchain] Init failed:", err.message);
    return false;
  }
}

/**
 * Auto-deploy CertificateNFT if not already deployed.
 * Uses the compiled Hardhat artifact + DEPLOYER_PRIVATE_KEY.
 * Saves address + ABI JSON so init() picks them up next time.
 */
export async function ensureDeployed() {
  // Already deployed? Just init and return.
  if (fs.existsSync(addrPath) && fs.existsSync(abiPath)) {
    init();
    return;
  }

  const { rpcUrl, privKey } = getRpcAndKey();
  if (!privKey) {
    console.warn("[Blockchain] No DEPLOYER_PRIVATE_KEY — skipping auto-deploy.");
    return;
  }

  if (!fs.existsSync(artifactPath)) {
    console.warn("[Blockchain] Compiled CertificateNFT artifact not found — run 'npx hardhat compile' first.");
    return;
  }

  try {
    console.log("[Blockchain] CertificateNFT not deployed — auto-deploying…");

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const prov = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privKey, prov);

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy();
    await contract.deployed();

    console.log(`[Blockchain] CertificateNFT deployed to ${contract.address}`);

    // Save artifacts to backend/deployed/
    if (!fs.existsSync(deployedDir)) fs.mkdirSync(deployedDir, { recursive: true });
    fs.writeFileSync(addrPath, JSON.stringify({ address: contract.address }, null, 2));
    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));

    // Copy to frontend/src/contracts/ if it exists
    if (fs.existsSync(frontendDir)) {
      fs.writeFileSync(join(frontendDir, "CertificateNFT-address.json"), JSON.stringify({ address: contract.address }, null, 2));
      fs.writeFileSync(join(frontendDir, "CertificateNFT-abi.json"), JSON.stringify(artifact.abi, null, 2));
    }

    // Reset init flag so next call picks up the new artifacts
    initialized = false;
    init();
  } catch (err) {
    console.error("[Blockchain] Auto-deploy failed:", err.message);
  }
}

// ── Public API ───────────────────────────────────────────

/**
 * Mint a CertificateNFT on-chain and update the DB row.
 *
 * @param {object} opts
 *   - certificateId        DB certificates.id
 *   - recipientWallet      0x… address of the recipient (user's linked wallet)
 *   - certificateNumber    e.g. "CC-TP-20260311-a4f8c2"
 *   - certificateHash      SHA-256 hex string
 *   - certificateType      e.g. "tree_purchase"
 * @returns {object|null}   { tokenId, txHash, blockNumber } or null if blockchain unavailable
 */
export async function mintCertificateNFT(opts) {
  if (!init()) return null;

  const {
    certificateId,
    recipientWallet,
    certificateNumber,
    certificateHash,
    certificateType,
  } = opts;

  // If recipient has no wallet linked, skip on-chain mint but keep DB cert
  if (!recipientWallet) {
    console.log(`[Blockchain] No wallet for cert ${certificateNumber} — skipping on-chain mint`);
    return null;
  }

  try {
    // Convert hex hash string to bytes32
    const hashBytes32 = "0x" + certificateHash.padStart(64, "0");
    const certTypeNum = CERT_TYPE_MAP[certificateType] || 0;

    const tx = await certContract.mintCertificate(
      recipientWallet,
      certificateNumber,
      hashBytes32,
      certTypeNum
    );

    const receipt = await tx.wait();

    // Parse CertificateMinted event to get tokenId
    const mintEvent = receipt.events?.find((e) => e.event === "CertificateMinted");
    const tokenId = mintEvent?.args?.tokenId?.toNumber() || null;

    // Update DB with on-chain data
    await pool.query(
      `UPDATE certificates
       SET token_id         = $1,
           tx_hash          = $2,
           block_number     = $3,
           chain_id         = $4,
           contract_address = $5,
           mint_status      = 'minted'
       WHERE id = $6`,
      [tokenId, receipt.transactionHash, receipt.blockNumber, chainId, contractAddress, certificateId]
    );

    console.log(
      `[Blockchain] Minted cert ${certificateNumber} → tokenId ${tokenId}, tx ${receipt.transactionHash}`
    );

    return {
      tokenId,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    };
  } catch (err) {
    console.error(`[Blockchain] Mint failed for cert ${certificateNumber}:`, err.message);

    // Mark as failed in DB so retry can pick it up
    await pool.query(
      `UPDATE certificates SET mint_status = 'failed' WHERE id = $1`,
      [certificateId]
    ).catch(() => {});

    return null;
  }
}

/**
 * Retry all certificates that are in 'pending' or 'failed' status.
 * Called on server startup and can be invoked periodically.
 */
export async function retryPendingMints() {
  if (!init()) return;

  const { rows } = await pool.query(
    `SELECT c.id, c.certificate_number, c.certificate_hash, c.certificate_type,
            u.wallet_address as recipient_wallet
     FROM certificates c
     JOIN users u ON u.id = c.recipient_user_id
     WHERE c.mint_status IN ('pending', 'failed')
       AND u.wallet_address IS NOT NULL
     ORDER BY c.id
     LIMIT 50`
  );

  if (rows.length === 0) return;
  console.log(`[Blockchain] Retrying ${rows.length} pending mints…`);

  for (const row of rows) {
    await mintCertificateNFT({
      certificateId: row.id,
      recipientWallet: row.recipient_wallet,
      certificateNumber: row.certificate_number,
      certificateHash: row.certificate_hash,
      certificateType: row.certificate_type,
    });
  }
}

/**
 * Check if on-chain minting is available.
 */
export function isBlockchainEnabled() {
  return init();
}

export default {
  mintCertificateNFT,
  retryPendingMints,
  isBlockchainEnabled,
};
