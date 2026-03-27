const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Prescription, Person, Patient, PractitionerRole } = require('../models/GridModels');

// 🔒 SECURITY TRIPWIRE
const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied.' });
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) { res.status(401).json({ msg: 'Invalid Token.' }); }
};

// ==========================================
// 📊 FETCH NATIONAL GRID STATISTICS
// ==========================================
router.get('/national-stats', authenticate, async (req, res) => {
    try {
        // 1. Prescription Volume
        const totalRx = await Prescription.countDocuments();
        const dispensedRx = await Prescription.countDocuments({ status: 'Dispensed' });
        const activeRx = totalRx - dispensedRx;

        // 2. Grid Demographics
        const totalPatients = await Patient.countDocuments();
        const totalDoctors = await PractitionerRole.countDocuments({ roleType: 'Doctor' });
        const totalPharmacies = await PractitionerRole.countDocuments({ roleType: 'Pharmacist' });

        // 3. The Aggregation Pipeline (Find Top 5 Most Prescribed Drugs)
        const topMeds = await Prescription.aggregate([
            { $unwind: "$medications" }, // Split arrays into individual drug records
            { $group: { _id: "$medications.brandName", count: { $sum: 1 } } }, // Count them
            { $sort: { count: -1 } }, // Sort highest to lowest
            { $limit: 5 } // Keep only the top 5
        ]);

        res.json({
            prescriptions: { total: totalRx, active: activeRx, dispensed: dispensedRx },
            demographics: { patients: totalPatients, doctors: totalDoctors, pharmacies: totalPharmacies },
            topMedications: topMeds
        });

    } catch (err) {
        console.error("ANALYTICS_ERR:", err);
        res.status(500).json({ msg: 'Analytics Engine Failure.' });
    }
});

module.exports = router;