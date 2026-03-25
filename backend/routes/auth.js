const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "Citizen already exists in the Grid." });

        user = new User({ name, email, password, role });
        await user.save();
        res.status(201).json({ msg: "Profile Registered Successfully." });
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        console.log(`🕵️‍♂️ Login Attempt: ${email} | Role: ${role}`);
        
        const user = await User.findOne({ email, role });
        if (!user) return res.status(400).json({ msg: "Identity not found in the Grid." });

        if (user.password !== password) return res.status(400).json({ msg: "Invalid Cryptographic Password." });

        if (!process.env.JWT_SECRET) return res.status(500).json({ msg: "SERVER CONFIG ERROR: JWT_SECRET is missing." });

        // Force ID to be a string
        const safeId = user._id.toString();

        const token = jwt.sign(
            { id: safeId, name: user.name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        console.log("✅ Token Forged! Transmitting to Gateway...");
        
        // Ensure exact payload structure the frontend expects
        res.json({ 
            token, 
            user: { id: safeId, name: user.name, role: user.role, email: user.email } 
        });

    } catch (err) {
        console.error("❌ FATAL LOGIN CRASH:", err);
        res.status(500).json({ msg: `System Failure: ${err.message}` });
    }
});

module.exports = router;