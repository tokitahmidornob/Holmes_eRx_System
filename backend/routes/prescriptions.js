const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Prescription = require('../models/Prescription');

const JWT_SECRET = process.env.JWT_SECRET || "HolmesIronVaultSecretKey2026";

// --- 🛑 SECURITY MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    if (!token) return res.status(401).json({ success: false, error: "Access Denied. Digital badge required." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: "Invalid or expired badge." });
        req.user = user; 
        next();
    });
};

// --- 📝 PRESCRIPTION ROUTES ---

// 1. Issue a New Prescription (Secured - Doctors Only)
router.post('/', authenticateToken, async (req, res) => {
    // 🛡️ Extra Security: Ensure only logged-in doctors can create prescriptions
    if (req.user.role !== 'doctor') {
        return res.status(403).json({ success: false, error: "Unauthorized. Only physicians may issue prescriptions." });
    }

    const incomingData = req.body; 
    const secureOTP = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
        const newRecord = new Prescription({ 
            recordId: "RX-" + Date.now(), 
            otp: secureOTP, 
            ...incomingData, 
            timestamp: new Date().toISOString() 
        });
        
        await newRecord.save();
        
        // ⚡ REAL-TIME QUEUE: Broadcast to the pharmacist waiting room!
        const io = req.app.get('io');
        if (io) {
            io.emit('new_prescription_alert', { message: "New prescription arrived!", recordId: newRecord.recordId });
        }

        res.status(201).json({ success: true, message: "Prescription securely archived!", otp: secureOTP });
    } catch (error) { 
        console.error("Prescription Error:", error);
        res.status(500).json({ success: false, error: "Vault lock failed." }); 
    }
});

// 2. Retrieve Prescription via OTP (Secured)
router.get('/:otp', authenticateToken, async (req, res) => {
    try {
        const foundRecord = await Prescription.findOne({ otp: req.params.otp });
        if (!foundRecord) return res.status(404).json({ success: false, error: "Invalid OTP. Record not found." });
        
        res.status(200).json({ success: true, data: foundRecord });
    } catch (error) { 
        res.status(500).json({ success: false, error: "Vault search failed." }); 
    }
});

module.exports = router;