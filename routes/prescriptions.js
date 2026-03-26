const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const jwt = require('jsonwebtoken');

// 🛡️ THE SECURITY TRIPWIRE
const securityLog = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000;

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
// 🩺 DOCTOR ROUTE 1: CREATE NEW PRESCRIPTION
// ==========================================
router.post('/', authenticate, async (req, res) => {
    try {
        const generatedBroadcastId = 'HOLMES-RX-' + Math.floor(1000 + Math.random() * 9000);
        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

        const newRx = new Prescription({
            ...req.body,
            broadcastId: generatedBroadcastId,
            otp: generatedOtp,
            status: 'Active'
        });
        
        const savedRx = await newRx.save();
        res.status(201).json(savedRx); // Instant UI Release!
        
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
// 💊 PHARMACIST ROUTE 1: VERIFY (WITH TRIPWIRE)
// ==========================================
router.get('/verify', authenticate, async (req, res) => {
    try {
        const { broadcastId, otp } = req.query;
        if (!broadcastId || !otp) return res.status(400).json({ msg: "Missing Broadcast ID or OTP." });

        const currentTime = Date.now();
        if (securityLog.has(broadcastId)) {
            const log = securityLog.get(broadcastId);
            if (log.lockUntil > currentTime) {
                const remainingMinutes = Math.ceil((log.lockUntil - currentTime) / 60000);
                return res.status(429).json({ msg: `SECURITY LOCKOUT: Vault locked for ${remainingMinutes} minutes.` });
            }
        }

        const rx = await Prescription.findOne({ broadcastId }).populate('doctorId', 'name email');
        if (!rx) return res.status(404).json({ msg: "Broadcast ID not found." });

        if (rx.otp !== otp) {
            let log = securityLog.get(broadcastId) || { attempts: 0, lockUntil: 0 };
            log.attempts += 1;

            if (log.attempts >= MAX_ATTEMPTS) {
                log.lockUntil = currentTime + LOCKOUT_TIME_MS;
                log.attempts = 0; 
                securityLog.set(broadcastId, log);
                return res.status(429).json({ msg: `TRIPWIRE TRIGGERED: Vault locked for 15 minutes.` });
            }

            securityLog.set(broadcastId, log);
            return res.status(401).json({ msg: `Invalid OTP. ${MAX_ATTEMPTS - log.attempts} attempts remaining.` });
        }

        securityLog.delete(broadcastId);

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
        if (!rx) return res.status(404).json({ msg: "Prescription not found." });
        if (rx.status === 'Dispensed') return res.status(400).json({ msg: "Already dispensed." });

        rx.status = 'Dispensed';
        await rx.save();
        res.json({ msg: "Prescription locked and dispensed." });
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

module.exports = router;