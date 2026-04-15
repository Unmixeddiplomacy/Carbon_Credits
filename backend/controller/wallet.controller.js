import crypto from 'crypto';
import { ethers } from 'ethers';
import pool from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const NONCE_TTL_MINUTES = Number(process.env.NONCE_TTL_MINUTES || 10);

export const request_link = async(req,res) => {
   try {

    const user = req.user;
    if(!user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = user.id;
    //nonce creation
    const raw = crypto.randomBytes(16).toString('hex');
    const nonce = `Link wallet to MyCarbonApp: ${raw} | user:${userId} | time:${Date.now()}`;
    const now = new Date();

        await pool.query(
            "UPDATE users SET wallet_nonce = $1 , wallet_nonce_created_at = $2 WHERE id = $3",
            [nonce, now, userId]
        );

    return res.json({ nonce });
   } catch (error) {
        console.error('request_link error', error);
    return res.status(500).json({ error: 'Server error' });
   }
}

export const verify_link = async(req,res) => {
    try {
        const user = req.user;
        if(!user) return res.status(401).json({ error: 'Not authenticated' });

        const {signature , address} = req.body;
        if (!signature || !address) return res.status(400).json({ error: 'Missing signature or address' });
        
        // reload user's nonce from DB for freshest data
                const { rows } = await pool.query(
                    'SELECT wallet_nonce, wallet_nonce_created_at FROM users WHERE id = $1',
                    [user.id]
                );
        const row = rows[0];
        if (!row || !row.wallet_nonce) return res.status(400).json({ error: 'No nonce found. Request a new one.' });

        const nonce = row.wallet_nonce;
        const createdAt = row.wallet_nonce_created_at;
        if (!createdAt) return res.status(400).json({ error: 'Nonce has no timestamp' });

        //check ttl
        const ttlMs = NONCE_TTL_MINUTES * 60 * 1000;

        if((Date.now() - new Date(createdAt).getTime()) > ttlMs){
            await pool.query("UPDATE users SET wallet_nonce = NULL , wallet_nonce_created_at = NULL WHERE id=$1" , [user.id]);
            return res.status(400).json({ error: 'Nonce expired. Request a new one.' });
        }

        //verify signature
        let recovered;
        try {
            recovered = ethers.utils.verifyMessage(nonce, signature);
        } catch (e) {
            console.error('Signature verify error', e);
            return res.status(400).json({ error: 'Signature verification failed' });
        }

        if (recovered.toLowerCase() !== address.toLowerCase()) {
        return res.status(400).json({ error: 'Signature does not match address' });
        }

                const { rows: existing } = await pool.query(
                    "SELECT id FROM users WHERE wallet_address = $1",
                    [address]
                );
                if (existing.length > 0 && existing[0].id !== user.id) {
            return res.status(400).json({ error: 'Address already linked to another account' });
        }
        // update user: set wallet_address and clear nonce
        await pool.query(
          "UPDATE users SET wallet_address = $1 , wallet_nonce = NULL , wallet_nonce_created_at = NULL WHERE id = $2",
          [address, user.id]
        );
        return res.json({ ok: true, walletAddress: address });
    } catch (error) {
        console.error('verify_link error', error);
        return res.status(500).json({ error: 'Server error' });
    }
}

export const unlink = async(req,res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const userId = user.id;
        await pool.query(
          "UPDATE users SET wallet_address = NULL WHERE id = $1",
          [userId]
        );
        return res.json({ ok: true });
    } catch (error) {
        console.error('unlink error', error);
        return res.status(500).json({ error: 'Server error' });
    }
}