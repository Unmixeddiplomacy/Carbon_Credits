import pool from "../config/db.js";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const abiPath = path.join(__dirname, "../deployed/TreeRegistry-abi.json");
const addressPath = path.join(__dirname, "../deployed/TreeRegistry-address.json");

const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
const { address: CONTRACT_ADDRESS } = JSON.parse(fs.readFileSync(addressPath, "utf8"));

const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || "http://127.0.0.1:8545"
);

const treeRowToDto = (row) => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  ownerWallet: row.owner_wallet,
  chainTreeId: row.chain_tree_id,
  metadataUri: row.metadata_uri,
  metadata: row.metadata,
  status: row.status,
  totalCreditsAccrued: parseFloat(row.total_credits_accrued) || 0,
  carbonAbsorptionKgPerYear: parseFloat(row.carbon_absorption_kg_per_year) || 0,
  lastVerifiedAt: row.last_verified_at,
  verificationRequiredBy: row.verification_required_by,
});

export const create_metadata = async(req,res) => {
    try {
    // auth: ensure req.user exists (you said you have auth). Replace as needed.
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { name, species, plantedAt, absorptionKgPerYear } = req.body;
    const metadata = {
      name,
      species,
      plantedAt,
      absorptionKgPerYear
    };

    const metadataUriBase = process.env.API_BASE || 'http://localhost:3000';
    // Insert DB row with pending status (requires verification to activate)
    // Location (lat/lon) will be set during first verification
    const insert = await pool.query(
      `INSERT INTO trees (owner_user_id, metadata_uri, metadata, status, carbon_absorption_kg_per_year) 
       VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
      [userId, null, metadata, Number(absorptionKgPerYear) || 0]
    );
    const dbId = insert.rows[0].id;
    const metadataURI = `${metadataUriBase}/api/trees/${dbId}/metadata`;

    // update with metadata_uri
    await pool.query('UPDATE trees SET metadata_uri = $1 WHERE id = $2', [metadataURI, dbId]);

    return res.json({ dbId, metadataURI });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export const metadata = async(req,res) => {
    try {
    const id = Number(req.params.id);
    const { rows } = await pool.query('SELECT metadata FROM trees WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    return res.json(rows[0].metadata);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export const list_trees = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { rows } = await pool.query(
      `SELECT id, owner_user_id, owner_wallet, chain_tree_id, metadata_uri, metadata, 
              status, total_credits_accrued, carbon_absorption_kg_per_year,
              last_verified_at, verification_required_by
       FROM trees 
       WHERE owner_user_id = $1
       ORDER BY id DESC`,
      [userId]
    );
    const data = rows.map(treeRowToDto);
    return res.json({ trees: data });
  } catch (err) {
    console.error("list_trees error", err);
    return res.status(500).json({ error: "Server error" });
  }
};

export const tree_detail = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const { rows } = await pool.query(
      `SELECT id, owner_user_id, owner_wallet, chain_tree_id, metadata_uri, metadata,
              status, total_credits_accrued, carbon_absorption_kg_per_year,
              last_verified_at, verification_required_by
       FROM trees WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });

    const tree = treeRowToDto(rows[0]);

    let onchain = null;
    if (tree.chainTreeId != null && tree.chainTreeId !== undefined) {
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
        const owner = await contract.ownerOf(tree.chainTreeId);
        const metadataURI = await contract.getMetadataURI(tree.chainTreeId);
        onchain = {
          owner,
          metadataURI,
          chainTreeId: tree.chainTreeId,
          contractAddress: CONTRACT_ADDRESS,
        };
      } catch (e) {
        console.warn("tree_detail on-chain lookup failed", e);
      }
    }

    return res.json({ tree, onchain });
  } catch (err) {
    console.error("tree_detail error", err);
    return res.status(500).json({ error: "Server error" });
  }
};

export const register_callback = async(req,res) => {
    try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { dbId, chainTreeId, ownerAddress } = req.body;
    if (typeof dbId === 'undefined' || typeof chainTreeId === 'undefined' || !ownerAddress) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Option (optional): verify owner on-chain
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
    const onchainOwner = await contract.ownerOf(chainTreeId);
    if (onchainOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Owner mismatch on chain' });
    }

    // update DB
    await pool.query(
      `UPDATE trees SET chain_tree_id = $1, owner_wallet = $2 WHERE id = $3`,
      [chainTreeId, ownerAddress, dbId]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('register-callback error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}