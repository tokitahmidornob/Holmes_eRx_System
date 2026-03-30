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
// 1. FETCH MASTER FORMULARY (Substance Intelligence Engine)
// ==========================================
router.get('/formulary', verifyToken, async (req, res) => {
    try {
        const drugs = await Medicine.find({}).lean().limit(5000); 
        
        const formularyArray = drugs.map(d => {
            const brand = d.brandName || d.BrandName || d.brand || d.Brand || '';
            const strength = d.strength || d.Strength || '';
            const form = d.form || d.Form || '';
            const generic = d.genericName || d.GenericName || d.generic || d.Generic || '';
            
            let fullName = `${brand} ${strength} ${form}`.trim();
            if (generic) fullName += ` (${generic})`;
            fullName = fullName.replace(/\s+/g, ' ') || "Unknown Drug";

            // Return a complete Intelligence Object instead of just a string
            return {
                display: fullName,
                // Automatically grabs default dosage, with a safety fallback
                dosage: d.defaultDosage || d.DefaultDosage || d.dosage || d.Dosage || d.dose || "1 Tablet",
                indications: d.indications || d.Indications || d.indication || "Data not in CSV",
                sideEffects: d.sideEffects || d.SideEffects || d.side_effects || "Data not in CSV",
                administration: d.administration || d.Administration || d.route || "Data not in CSV"
            };
        }).filter(d => d.display !== "Unknown Drug");

        // Deduplicate the objects
        const uniqueDrugs = [];
        const map = new Map();
        for (const item of formularyArray) {
            if(!map.has(item.display)) {
                map.set(item.display, true);
                uniqueDrugs.push(item);
            }
        }

        res.json(uniqueDrugs);
    } catch (err) {
        console.error("FORMULARY_ERR:", err);
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

// ==========================================
// 🔍 MPI AUTOCOMPLETE SEARCH ENGINE
// ==========================================
router.post('/search', verifyToken, async (req, res) => {
    try {
        // Only Doctors can query the Master Patient Index
        if (req.user.role !== 'doctor') return res.status(403).json({ msg: "Clearance Required." });
        
        const { query } = req.body;
        if (!query) return res.json([]);

        const { Person, Patient } = require('../models/GridModels');

        // 1. Find Persons whose name matches the typed query (case-insensitive)
        const persons = await Person.find({ legalFullName: { $regex: query, $options: 'i' } });
        const personIds = persons.map(p => p._id);

        // 2. Find Patients matching those names OR matching their exact NHI/NID
        const patients = await Patient.find({
            $or: [
                { personId: { $in: personIds } },
                { nationalHealthId: { $regex: query, $options: 'i' } },
                { nationalId: { $regex: query, $options: 'i' } }
            ]
        }).populate('personId');

        // 3. Format the data exactly as your glowing frontend dropdown expects
        const results = patients.map(pat => ({
            patientId: pat._id,
            name: pat.personId ? pat.personId.legalFullName : 'Unknown Citizen',
            age: pat.personId && pat.personId.dateOfBirth ? (new Date().getFullYear() - new Date(pat.personId.dateOfBirth).getFullYear()) : 'N/A',
            gender: pat.personId ? pat.personId.genderLegal : 'Unknown',
            nhi: pat.nationalHealthId || 'NHI-PENDING'
        }));

        res.json(results);
    } catch (err) {
        console.error("SEARCH_ERR:", err);
        res.status(500).json({ msg: "Grid Network Failure" });
    }
});

module.exports = router;