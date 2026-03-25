const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const jwt = require('jsonwebtoken');

// 🛡️ SECURITY VAULT
const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied: No Cryptographic Token Provided' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Access Denied: Token Tampered or Expired' });
    }
};

// ==========================================
// 🩺 DOCTOR ROUTE 1: CREATE NEW PRESCRIPTION
// ==========================================
router.post('/', authenticate, async (req, res) => {
    try {
        // 🌟 FIXED: RESTORING THE MISSING IDENTIFIERS 🌟
        const generatedBroadcastId = 'HOLMES-RX-' + Math.floor(1000 + Math.random() * 9000);
        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

        const newRx = new Prescription({
            ...req.body,
            broadcastId: generatedBroadcastId,
            otp: generatedOtp,
            status: 'Active'
        });
        const savedRx = await newRx.save();
        res.status(201).json(savedRx);
    } catch (err) {
        console.error("Create Rx Error:", err);
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 🩺 DOCTOR ROUTE 2: FETCH DOCTOR'S HISTORY
// ==========================================
router.get('/doctor/:id', authenticate, async (req, res) => {
    try {
        const rxs = await Prescription.find({ doctorId: req.params.id }).sort({ createdAt: -1 });
        res.json(rxs);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 👤 PATIENT ROUTE: FETCH PATIENT'S HISTORY
// ==========================================
router.get('/patient/:email', authenticate, async (req, res) => {
    try {
        const rxs = await Prescription.find({ patientId: req.params.email })
            .populate('doctorId', 'name email')
            .sort({ createdAt: -1 });
        res.json(rxs);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 💊 PHARMACIST ROUTE 1: VERIFY VIA OTP
// ==========================================
router.get('/verify', authenticate, async (req, res) => {
    try {
        const { broadcastId, otp } = req.query;
        if (!broadcastId || !otp) return res.status(400).json({ msg: "Missing Broadcast ID or OTP." });

        const rx = await Prescription.findOne({ broadcastId, otp }).populate('doctorId', 'name email');
        if (!rx) return res.status(404).json({ msg: "Invalid Broadcast ID or OTP." });

        let formattedRx = rx.toObject();
        if (typeof formattedRx.patientId === 'string') {
            formattedRx.patientId = { name: formattedRx.patientId }; 
        }

        res.json(formattedRx);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 💊 PHARMACIST ROUTE 2: DISPENSE & LOCK
// ==========================================
router.put('/:id/dispense', authenticate, async (req, res) => {
    try {
        const rx = await Prescription.findById(req.params.id);
        if (!rx) return res.status(404).json({ msg: "Prescription not found in the Grid." });
        if (rx.status === 'Dispensed') return res.status(400).json({ msg: "This prescription has already been dispensed." });

        rx.status = 'Dispensed';
        await rx.save();
        res.json({ msg: "Prescription locked and dispensed successfully." });
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

module.exports = router;