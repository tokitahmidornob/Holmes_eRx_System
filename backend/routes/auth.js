const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "Citizen already exists in the Grid." });

        user = new User({ name, email, password, role });
        await user.save();
        
        res.status(201).json({ msg: "Profile Registered Successfully." });
    } catch (err) {
        console.error("Registration Crash:", err);
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        console.log(`🕵️‍♂️ Login Attempt: ${email} | Role: ${role}`);
        
        const user = await User.findOne({ email, role });
        if (!user) return res.status(400).json({ msg: "Identity not found in the Grid." });

        // Simple password comparison (matching your current database setup)
        if (user.password !== password) {
            return res.status(400).json({ msg: "Invalid Cryptographic Password." });
        }
        console.log("✅ Password Verified! Attempting Token Generation...");

        // THE BULLETPROOF CHECK
        if (!process.env.JWT_SECRET) {
            console.error("❌ CRITICAL: JWT_SECRET is missing from Render Environment Variables!");
            return res.status(500).json({ msg: "SERVER CONFIG ERROR: JWT_SECRET is missing." });
        }

        const token = jwt.sign(
            { id: user._id, name: user.name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        console.log("✅ Token Forged! Transmitting to Gateway...");
        res.json({ token, user: { id: user._id, name: user.name, role: user.role, email: user.email } });

    } catch (err) {
        // This catches the silent crashes!
        console.error("❌ FATAL LOGIN CRASH:", err);
        res.status(500).json({ msg: `System Failure: ${err.message}` });
    }
});

module.exports = router;