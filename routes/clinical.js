const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Patient, Person, AllergyProfile, Medicine } = require('../models/GridModels');

// Cryptographic Check
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: "Grid Access Denied." });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) { res.status(400).json({ msg: "Invalid Identity Token." }); }
};

// ==========================================
// 1. FETCH MASTER FORMULARY (Drugs)
// ==========================================
router.get('/formulary', verifyToken, async (req, res) => {
    try {
        const drugs = await Medicine.find({}).select('brandName strength form -_id');
        const formularyArray = drugs.map(d => `${d.brandName} ${d.strength ? d.strength : ''} ${d.form ? d.form : ''}`.trim());
        res.json(formularyArray);
    } catch (err) {
        res.status(500).json({ msg: "Database connection failed." });
    }
});

// ==========================================
// 2. MPI SEARCH ENGINE (Find Patient)
// ==========================================
router.post('/search', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') return res.status(403).json({ msg: "Clearance Required." });
        const { query } = req.body;
        if (!query) return res.json([]);

        const persons = await Person.find({ legalFullName: { $regex: query, $options: 'i' } });
        const personIds = persons.map(p => p._id);

        const patients = await Patient.find({
            $or: [
                { personId: { $in: personIds } },
                { nationalHealthId: { $regex: query, $options: 'i' } },
                { nationalId: { $regex: query, $options: 'i' } }
            ]
        }).populate('personId');

        const results = patients.map(pat => ({
            patientId: pat._id,
            name: pat.personId ? pat.personId.legalFullName : 'Unknown Citizen',
            age: pat.personId && pat.personId.dateOfBirth ? (new Date().getFullYear() - new Date(pat.personId.dateOfBirth).getFullYear()) : 'N/A',
            gender: pat.personId ? pat.personId.genderLegal : 'Unknown',
            nhi: pat.nationalHealthId || pat.nationalId || 'NHI-PENDING'
        }));
        res.json(results);
    } catch (err) {
        console.error("SEARCH_ERR:", err);
        res.status(500).json({ msg: "Grid Network Failure" });
    }
});

// ==========================================
// 3. CLINICAL DOSSIER (Fetch Allergies)
// ==========================================
router.get('/dossier/:id', verifyToken, async (req, res) => {
    try {
        const patientId = req.params.id;
        const allergies = await AllergyProfile.find({ patientId: patientId });
        
        res.json({
            allergies: allergies,
            conditions: [], // Placeholder for future features
            activeMedications: [] // Placeholder for future features
        });
    } catch (err) {
        console.error("DOSSIER_ERR:", err);
        res.status(500).json({ msg: "Failed to fetch patient dossier" });
    }
});

module.exports = router;