import { ethers } from "ethers";
import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const deployedDir = join(__dirname, "..", "deployed");
const abiPath = join(deployedDir, "CarbonCredit-abi.json");
const addrPath = join(deployedDir, "CarbonCredit-address.json");

const parsedScale = Number.parseInt(process.env.CARBON_CHAIN_UNIT_SCALE || "10000", 10);
const UNIT_SCALE = Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : 10000;

let initialized = false;
let provider = null;
let signer = null;
let carbonCreditContract = null;

function getRpcAndKey() {
  const rpcUrl =
    process.env.RPC_URL ||
    process.env.BLOCKCHAIN_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    process.env.HARDHAT_RPC_URL ||
    "http://127.0.0.1:8545";

  const privKey = process.env.ORACLE_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  return { rpcUrl, privKey };
}

function toChainUnits(amountKg) {
  const numeric = Number.parseFloat(String(amountKg ?? ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * UNIT_SCALE);
}

function buildBatchId(prefix, reference) {
  const input = `${prefix}:${reference || Date.now().toString()}`;
  return ethers.utils.id(input);
}

function init() {
  if (initialized) return !!carbonCreditContract;
  initialized = true;

  try {
    if (!fs.existsSync(abiPath) || !fs.existsSync(addrPath)) {
      console.warn("[CarbonCredit] ABI/address not found. On-chain sync disabled.");
      return false;
    }

    const { rpcUrl, privKey } = getRpcAndKey();
    if (!privKey) {
      console.warn("[CarbonCredit] ORACLE_PRIVATE_KEY/DEPLOYER_PRIVATE_KEY missing. On-chain sync disabled.");
      return false;
    }

    const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    const { address } = JSON.parse(fs.readFileSync(addrPath, "utf8"));

    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    signer = new ethers.Wallet(privKey, provider);
    carbonCreditContract = new ethers.Contract(address, abi, signer);

    return true;
  } catch (err) {
    console.error("[CarbonCredit] Init failed:", err.message);
    return false;
  }
}

export function isCarbonCreditSyncEnabled() {
  return init();
}

export async function syncIssueCreditsOnChain({
  chainTreeId,
  recipientWallet,
  amountKg,
  source = "issue",
  reference,
}) {
  if (!init()) return null;

  const parsedTreeId = Number.parseInt(String(chainTreeId ?? ""), 10);
  if (!Number.isFinite(parsedTreeId)) {
    console.warn("[CarbonCredit] Skipping issue sync: missing chain_tree_id");
    return null;
  }

  if (!recipientWallet || !ethers.utils.isAddress(recipientWallet)) {
    console.warn("[CarbonCredit] Skipping issue sync: invalid recipient wallet");
    return null;
  }

  const amountUnits = toChainUnits(amountKg);
  if (amountUnits <= 0) {
    console.warn("[CarbonCredit] Skipping issue sync: amount too small", { amountKg, amountUnits });
    return null;
  }

  try {
    const batchId = buildBatchId(source, reference || `${parsedTreeId}:${recipientWallet}:${amountUnits}`);

    const tx = await carbonCreditContract.issueCredits(
      parsedTreeId,
      recipientWallet,
      amountUnits,
      batchId
    );

    const receipt = await tx.wait();
    console.log(
      `[CarbonCredit] Issued on-chain ${amountKg} kg (${amountUnits} units) to ${recipientWallet}. tx=${receipt.transactionHash}`
    );

    return {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      amountUnits,
    };
  } catch (err) {
    console.error("[CarbonCredit] issueCredits sync failed:", err.message);
    return null;
  }
}

export async function syncSlashCreditsOnChain({
  chainTreeId,
  fromWallet,
  amountKg,
  reason,
  source = "slash",
  reference,
}) {
  if (!init()) return null;

  const parsedTreeId = Number.parseInt(String(chainTreeId ?? ""), 10);
  if (!Number.isFinite(parsedTreeId)) {
    console.warn("[CarbonCredit] Skipping slash sync: missing chain_tree_id");
    return null;
  }

  if (!fromWallet || !ethers.utils.isAddress(fromWallet)) {
    console.warn("[CarbonCredit] Skipping slash sync: invalid source wallet");
    return null;
  }

  const amountUnits = toChainUnits(amountKg);
  if (amountUnits <= 0) {
    console.warn("[CarbonCredit] Skipping slash sync: amount too small", { amountKg, amountUnits });
    return null;
  }

  try {
    const slashReason = reason || `${source}:${reference || Date.now().toString()}`;

    const tx = await carbonCreditContract.slashCredits(
      parsedTreeId,
      fromWallet,
      amountUnits,
      slashReason
    );

    const receipt = await tx.wait();
    console.log(
      `[CarbonCredit] Slashed on-chain ${amountKg} kg (${amountUnits} units) from ${fromWallet}. tx=${receipt.transactionHash}`
    );

    return {
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      amountUnits,
    };
  } catch (err) {
    console.error("[CarbonCredit] slashCredits sync failed:", err.message);
    return null;
  }
}

export default {
  isCarbonCreditSyncEnabled,
  syncIssueCreditsOnChain,
  syncSlashCreditsOnChain,
};
