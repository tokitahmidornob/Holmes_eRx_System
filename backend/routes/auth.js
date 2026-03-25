const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 🌟 NEW: The ID Generation Engine
const generateGridId = (role) => {
    const prefixes = {
        doctor: 'DR',
        patient: 'PT',
        pharmacist: 'PH',
        pathologist: 'PA'
    };
    const prefix = prefixes[role] || 'USR';
    // Generates a random 6-digit number (e.g., DR-482910)
    const randomNum = Math.floor(100000 + Math.random() * 900000); 
    return `${prefix}-${randomNum}`;
};

// ==========================================
// 📝 REGISTRATION ROUTE
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "Citizen already exists in the Grid." });

        // Generate the new ID at the exact moment of registration
        const gridId = generateGridId(role);

        user = new User({ name, email, password, role, gridId });
        await user.save();
        
        res.status(201).json({ msg: `Profile Registered Successfully. Assigned ID: ${gridId}` });
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 🔐 LOGIN ROUTE (WITH RETROACTIVE PATCH)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        console.log(`🕵️‍♂️ Login Attempt: ${email} | Role: ${role}`);
        
        const user = await User.findOne({ email, role });
        if (!user) return res.status(400).json({ msg: "Identity not found in the Grid." });

        if (user.password !== password) return res.status(400).json({ msg: "Invalid Cryptographic Password." });
        if (!process.env.JWT_SECRET) return res.status(500).json({ msg: "SERVER CONFIG ERROR: JWT_SECRET is missing." });

        // 🛠️ THE RETROACTIVE PATCH: Upgrading Old Users
        if (!user.gridId) {
            console.log(`⚠️ Old user detected without ID. Patching ${user.email}...`);
            user.gridId = generateGridId(user.role);
            await user.save();
            console.log(`✅ Patch successful. Assigned new ID: ${user.gridId}`);
        }

        const safeId = user._id.toString();

        const token = jwt.sign(
            { id: safeId, name: user.name, role: user.role, gridId: user.gridId },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        console.log("✅ Token Forged! Transmitting to Gateway...");
        
        res.json({ 
            token, 
            user: { 
                id: safeId, 
                name: user.name, 
                role: user.role, 
                email: user.email,
                gridId: user.gridId // Sending the ID to the frontend
            } 
        });

    } catch (err) {
        console.error("❌ FATAL LOGIN CRASH:", err);
        res.status(500).json({ msg: `System Failure: ${err.message}` });
    }
});

module.exports = router;