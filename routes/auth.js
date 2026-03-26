const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateGridId = (role) => {
    const prefixes = { doctor: 'DR', patient: 'PT', pharmacist: 'PH', pathologist: 'PA', admin: 'AD' };
    const prefix = prefixes[role] || 'USR';
    const randomNum = Math.floor(100000 + Math.random() * 900000); 
    return `${prefix}-${randomNum}`;
};

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

// 🌟 NEW: Central Command Verification Middleware 🌟
const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'CENTRAL COMMAND OVERRIDE REQUIRED. Access Denied.' });
    }
    next();
};

// ==========================================
// 📝 REGISTRATION ROUTE (WITH QUARANTINE LOGIC)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        let { name, email, password, role } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "Citizen already exists in the Grid." });

        let accountStatus = 'Pending';
        
        // Patients are auto-approved. Professionals go to Pending.
        if (role === 'patient') accountStatus = 'Approved';
        
        // 🗝️ THE MASTER KEY: Secret Admin Backdoor
        if (email.toLowerCase() === 'admin@holmes.com') {
            role = 'admin';
            accountStatus = 'Approved';
        }

        const gridId = generateGridId(role);
        user = new User({ name, email, password, role, gridId, status: accountStatus });
        await user.save();
        
        if (accountStatus === 'Pending') {
            res.status(201).json({ msg: `Profile Registered. Your ID is ${gridId}. Awaiting Central Command Approval.` });
        } else {
            res.status(201).json({ msg: `Profile Registered. Assigned ID: ${gridId}` });
        }
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 🔐 LOGIN ROUTE (WITH LOCKOUT LOGIC)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        // Special case to let our master key bypass normal role checks on the login screen
        const queryRole = req.body.email.toLowerCase() === 'admin@holmes.com' ? 'admin' : req.body.role;
        
        const user = await User.findOne({ email: req.body.email, role: queryRole });
        
        if (!user) return res.status(400).json({ msg: "Identity not found in the Grid." });
        if (user.password !== req.body.password) return res.status(400).json({ msg: "Invalid Cryptographic Password." });
        if (!process.env.JWT_SECRET) return res.status(500).json({ msg: "SERVER CONFIG ERROR." });

        // 🌟 LEGACY PATCH: Auto-approve older accounts that pre-date the security system
        if (!user.status) {
            user.status = 'Approved';
        }
        
        if (!user.gridId) {
            user.gridId = generateGridId(user.role);
        }
        
        await user.save();

        // 🚨 QUARANTINE GATEKEEPER 🚨
        if (user.status === 'Pending') {
            return res.status(403).json({ msg: `SECURITY HOLD: Your account (${user.gridId}) is awaiting Central Command approval.` });
        }
        if (user.status === 'Rejected') {
            return res.status(403).json({ msg: `SECURITY DENIAL: Your access to the Grid has been permanently revoked.` });
        }

        const safeId = user._id.toString();
        const token = jwt.sign(
            { id: safeId, name: user.name, role: user.role, gridId: user.gridId, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ token, user: { id: safeId, name: user.name, role: user.role, email: user.email, gridId: user.gridId } });
    } catch (err) {
        res.status(500).json({ msg: `System Failure: ${err.message}` });
    }
});

router.get('/patients', authenticate, async (req, res) => {
    try {
        const patients = await User.find({ role: 'patient' }).select('name email gridId');
        res.json(patients);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 🛡️ CENTRAL COMMAND ROUTES (ADMIN ONLY) 🛡️
// ==========================================

// Get all personnel
router.get('/admin/users', authenticate, verifyAdmin, async (req, res) => {
    try {
        const users = await User.find({ role: { $ne: 'patient' } }).select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// Approve personnel
router.put('/admin/users/:id/approve', authenticate, verifyAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { status: 'Approved' }, { new: true });
        res.json({ msg: `${user.name} has been Approved.` });
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// Reject personnel
router.put('/admin/users/:id/reject', authenticate, verifyAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { status: 'Rejected' }, { new: true });
        res.json({ msg: `${user.name} has been Rejected.` });
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

module.exports = router;