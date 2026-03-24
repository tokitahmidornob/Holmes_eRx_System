const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const Prescription = require('../models/Prescription');

const JWT_SECRET = process.env.JWT_SECRET || "HolmesIronVaultSecretKey2026";

// --- 🛑 SECURITY MIDDLEWARE ---
// This acts as the bouncer. It checks the digital ID badge before letting anyone in.
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer [token]"
    
    if (!token) return res.status(401).json({ success: false, error: "Access Denied: No digital badge provided." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: "Access Denied: Invalid or expired badge." });
        req.user = user; 
        next();
    });
};

// --- 🧑‍⚕️ PATIENT ROUTES ---

// 1. Get Patient Profile (Secured)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const patient = await Patient.findOne({ patientId: req.params.id }).select('-password');
        if (!patient) return res.status(404).json({ success: false, error: "Patient not found." });
        
        res.status(200).json({ success: true, data: patient });
    } catch (error) { 
        res.status(500).json({ success: false, error: "Vault search failed." }); 
    }
});

// 2. Update Patient Profile (Secured)
router.put('/:id/profile', authenticateToken, async (req, res) => {
    try {
        const { age, gender, bloodGroup, contact, emergencyContact, address, allergies } = req.body;
        
        // Ensure allergies is an array
        const allergiesArray = typeof allergies === 'string' ? allergies.split(',').map(a => a.trim()) : allergies;

        const updatedPatient = await Patient.findOneAndUpdate(
            { patientId: req.params.id },
            { age, gender, bloodGroup, contact, emergencyContact, address, allergies: allergiesArray },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedPatient) return res.status(404).json({ success: false, error: "Patient not found." });

        res.status(200).json({ success: true, message: "Profile updated successfully!", data: updatedPatient });
    } catch (error) { 
        res.status(500).json({ success: false, error: "Failed to update profile." }); 
    }
});

// 3. Add Manual Medical History (Secured)
router.post('/:id/history', authenticateToken, async (req, res) => {
    try {
        const { date, title, description } = req.body;
        
        const updatedPatient = await Patient.findOneAndUpdate(
            { patientId: req.params.id },
            { $push: { 
                medicalHistory: { date, title, description, type: 'manual', addedAt: new Date() } 
            }},
            { new: true }
        ).select('-password');

        res.status(200).json({ success: true, message: "History updated!", data: updatedPatient });
    } catch (error) { 
        res.status(500).json({ success: false, error: "Failed to add medical history." }); 
    }
});

module.exports = router;