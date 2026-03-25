const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Pharmacist = require('../models/Pharmacist');

const JWT_SECRET = process.env.JWT_SECRET || "HolmesIronVaultSecretKey2026";

// --- 🛑 SECURITY MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    if (!token) return res.status(401).json({ success: false, error: "Access Denied." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: "Invalid badge." });
        req.user = user; 
        next();
    });
};

// --- 💊 PHARMACIST ROUTES ---

// 1. Get Pharmacist Profile (Secured)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const pharmacist = await Pharmacist.findOne({ pharmacistId: req.params.id }).select('-password');
        if (!pharmacist) return res.status(404).json({ success: false, error: "Pharmacist not found." });
        
        res.status(200).json({ success: true, data: pharmacist });
    } catch (error) { 
        res.status(500).json({ success: false, error: "Vault search failed." }); 
    }
});

// 2. Update Pharmacist Profile (Secured)
router.put('/:id/profile', authenticateToken, async (req, res) => {
    try {
        const { employeeId, contactNumber, licenseNumber, branchLocation, degrees, experienceYears, biography } = req.body;
        const degreesArray = typeof degrees === 'string' ? degrees.split(',').map(d => d.trim()) : degrees;

        const updatedPharmacist = await Pharmacist.findOneAndUpdate(
            { pharmacistId: req.params.id },
            { employeeId, contactNumber, licenseNumber, branchLocation, degrees: degreesArray, experienceYears, biography },
            { new: true, runValidators: true }
        ).select('-password');

        res.status(200).json({ success: true, message: "Profile updated!", data: updatedPharmacist });
    } catch (error) { 
        res.status(500).json({ success: false, error: "Failed to update profile." }); 
    }
});

module.exports = router;