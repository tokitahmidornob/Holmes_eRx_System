const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 🌟 THE ID GENERATION ENGINE
const generateGridId = (role) => {
    const prefixes = { doctor: 'DR', patient: 'PT', pharmacist: 'PH', pathologist: 'PA' };
    const prefix = prefixes[role] || 'USR';
    const randomNum = Math.floor(100000 + Math.random() * 900000); 
    return `${prefix}-${randomNum}`;
};

// 🛡️ SECURITY MIDDLEWARE
const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied.' });
    try {
        const token = authHeader.split(' ')[1];
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Invalid Token.' });
    }
};

// ==========================================
// 📝 REGISTRATION ROUTE
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "Citizen already exists in the Grid." });

        const gridId = generateGridId(role);
        user = new User({ name, email, password, role, gridId });
        await user.save();
        
        res.status(201).json({ msg: `Profile Registered. Assigned ID: ${gridId}` });
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
        const user = await User.findOne({ email, role });
        
        if (!user) return res.status(400).json({ msg: "Identity not found in the Grid." });
        if (user.password !== password) return res.status(400).json({ msg: "Invalid Cryptographic Password." });
        if (!process.env.JWT_SECRET) return res.status(500).json({ msg: "SERVER CONFIG ERROR: JWT_SECRET missing." });

        if (!user.gridId) {
            user.gridId = generateGridId(user.role);
            await user.save();
        }

        const safeId = user._id.toString();
        const token = jwt.sign(
            { id: safeId, name: user.name, role: user.role, gridId: user.gridId },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ 
            token, 
            user: { id: safeId, name: user.name, role: user.role, email: user.email, gridId: user.gridId } 
        });
    } catch (err) {
        res.status(500).json({ msg: `System Failure: ${err.message}` });
    }
});

// ==========================================
// 🏥 NEW: FETCH ALL PATIENTS FOR DOCTOR
// ==========================================
router.get('/patients', authenticate, async (req, res) => {
    try {
        // Find all users with the role of 'patient', return only needed fields
        const patients = await User.find({ role: 'patient' }).select('name email gridId');
        res.json(patients);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

module.exports = router;