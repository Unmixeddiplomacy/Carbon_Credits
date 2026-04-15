import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV == 'production',
    sameSite: 'Strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

export const register = async (req, res) => {
    const {name , email , password} = req.body;
    try {
    if(!name || !email || !password){
        return res.status(400).json({message: 'Please provide all required fields'})
    }

    const userExists = await pool.query('SELECT * FROM users WHERE email = $1',[email]);

    if(userExists.rows.length > 0){
        return res.status(400).json({message: 'User already exists'})
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
        "INSERT INTO users (name , email , password) VALUES ($1,$2,$3) RETURNING id, name, email, role, wallet_address AS \"walletAddress\"",
        [name, email, hashedPassword]
    );

    const token = generateToken(newUser.rows[0].id);

    res.cookie('token', token, cookieOptions);

    return res.status(201).json({ user: newUser.rows[0] });
    } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({message: "Internal server error"})
   }
};

export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
    if(!email || !password) return res.status(400).json({message: "Provide all required fields"});

    const user = await pool.query('SELECT * FROM users WHERE email = $1' , [email]);

    if(user.rows.length === 0){
        return res.status(400).json({message: 'Invalid Credentials'});
    }

    const userData = user.rows[0];
    const isMatch = await bcrypt.compare(password, userData.password);

    if(!isMatch){
        return res.status(400).json({message: 'Invalid Credentials'});
    }
    const token = generateToken(userData.id);
    res.cookie('token', token, cookieOptions);

    res.json({
          user: {
              id: userData.id,
              name: userData.name,
              email: userData.email,
              role: userData.role || 'user',
              walletAddress: userData.wallet_address || null,
          },
      });
    } catch (error) {
        console.log("Error in login controller", error.message);
        res.status(500).json({message: "Internal server error"})
    } 
    };


export const logout = async (req, res) => {
    try {
    res.cookie('token', '', { ...cookieOptions, maxAge: 0 });
    res.json({ message: "Logged out Successfully" });
    } catch (error) {
        console.log("Error in login controller", error.message);
        res.status(500).json({message: "Internal server error"})
    }
};

// Return the currently authenticated user based on the JWT cookie
export const me = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        return res.json({ user: req.user });
    } catch (error) {
        console.log("Error in me controller", error.message);
        res.status(500).json({ message: "Internal server error" });
    }
};