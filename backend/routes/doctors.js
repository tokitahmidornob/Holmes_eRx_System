const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');

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

// --- 👨‍⚕️ DOCTOR ROUTES ---

// 1. Get Public Doctor Directory (NO Token Required - Patients need to see this!)
router.get('/', async (req, res) => {
    try {
        // Returns all doctors but hides passwords and sensitive backend data
        const doctors = await Doctor.find({}).select('-password -__v');
        res.status(200).json({ success: true, data: doctors });
    } catch (error) { 
        res.status(500).json({ success: false, error: "Failed to fetch directory." }); 
    }
});

// 2. Get Specific Doctor Profile (Secured)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ doctorId: req.params.id }).select('-password');
        if (!doctor) return res.status(404).json({ success: false, error: "Doctor not found." });
        
        res.status(200).json({ success: true, data: doctor });
    } catch (error) { 
        res.status(500).json({ success: false, error: "Vault search failed." }); 
    }
});

// 3. Update Professional Profile (Secured)
router.put('/:id/profile', authenticateToken, async (req, res) => {
    try {
        const { contactNumber, licenseNumber, designation, department, degrees, specialties, experienceYears, consultationHours, biography } = req.body;
        
        const degreesArray = typeof degrees === 'string' ? degrees.split(',').map(d => d.trim()) : degrees;
        const specialtiesArray = typeof specialties === 'string' ? specialties.split(',').map(s => s.trim()) : specialties;

        const updatedDoctor = await Doctor.findOneAndUpdate(
            { doctorId: req.params.id },
            { contactNumber, licenseNumber, designation, department, degrees: degreesArray, specialties: specialtiesArray, experienceYears, consultationHours, biography, isProfileComplete: true },
            { new: true, runValidators: true }
        ).select('-password');

        res.status(200).json({ success: true, message: "Profile updated!", data: updatedDoctor });
    } catch (error) { 
        res.status(500).json({ success: false, error: "Failed to update profile." }); 
    }
});

module.exports = router;