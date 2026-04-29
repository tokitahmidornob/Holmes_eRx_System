const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { AllergyProfile, Patient } = require('../models/GridModels');

// Cryptographic Middleware to verify the user's Token
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: "Grid Access Denied." });
    try {
        const verified = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ msg: "Invalid Identity Token." });
    }
};

// POST: Add a new Allergy to the Dossier
router.post('/allergy', verifyToken, async (req, res) => {
    try {
        const { substance, criticality } = req.body;
        
        // 1. Find the specific Patient Profile using the Person ID from the token
        const patientRecord = await Patient.findOne({ personId: req.user.id });
        if (!patientRecord) return res.status(404).json({ msg: "Citizen profile not found." });

        // 2. Create the Allergy Record mapped to this specific patient
        const newAllergy = new AllergyProfile({
            patientId: patientRecord._id,
            substance: substance,
            criticality: criticality || 'Unknown',
            verificationStatus: 'Unconfirmed' // Because it is self-reported by the patient
        });

        await newAllergy.save();
        res.status(201).json({ msg: "Allergy securely logged." });

    } catch (err) {
        console.error("ALLERGY_ERROR:", err);
        res.status(500).json({ msg: "Grid Server Error" });
    }
});

module.exports = router;