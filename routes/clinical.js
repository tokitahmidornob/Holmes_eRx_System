const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Patient, Person, AllergyProfile } = require('../models/GridModels');

const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: "Grid Access Denied." });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) { res.status(400).json({ msg: "Invalid Identity Token." }); }
};

// ==========================================
// 🔍 QUERY MASTER PATIENT INDEX (MPI)
// ==========================================
router.get('/query-patient/:identifier', verifyToken, async (req, res) => {
    try {
        // Only Doctors and Admin can query the MPI
        if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
            return res.status(403).json({ msg: "Unauthorized Terminal Action." });
        }

        const identifier = req.params.identifier.trim();
        
        // 1. Search for Patient by NHI or NID
        const patientData = await Patient.findOne({
            $or: [ { nationalHealthId: identifier }, { nationalId: identifier } ]
        }).populate('personId', 'legalFullName contact dateOfBirth genderLegal');

        if (!patientData) {
            return res.status(404).json({ msg: "No Citizen found with that Grid Identifier." });
        }

        // 2. Fetch the Clinical Dossier (Allergies) for the Contraindication Engine
        const allergies = await AllergyProfile.find({ patientId: patientData._id });

        res.json({
            patientId: patientData._id,
            nhi: patientData.nationalHealthId,
            name: patientData.personId.legalFullName,
            age: patientData.personId.dateOfBirth ? (new Date().getFullYear() - new Date(patientData.personId.dateOfBirth).getFullYear()) : 'Unknown',
            gender: patientData.personId.genderLegal || 'Unknown',
            bloodGroup: patientData.bloodGroup || 'Unknown',
            allergies: allergies
        });

    } catch (err) {
        console.error("MPI_QUERY_ERROR:", err);
        res.status(500).json({ msg: "MPI Query Engine Offline." });
    }
});

module.exports = router;