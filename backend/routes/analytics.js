const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const Medicine = require('../models/Medicine');

router.get('/stats', async (req, res) => {
    try {
        const totalPrescriptions = await Prescription.countDocuments();
        const totalMedicines = await Medicine.countDocuments();
        
        // Count users by role
        const doctors = await User.countDocuments({ role: 'doctor' });
        const patients = await User.countDocuments({ role: 'patient' });
        const pharmacists = await User.countDocuments({ role: 'pharmacist' });

        // Get the last 5 activities
        const recentActivity = await Prescription.find()
            .sort({ createdAt: -1 })
            .limit(5);

        res.json({
            success: true,
            stats: {
                prescriptions: totalPrescriptions,
                medicines: totalMedicines,
                users: {
                    total: doctors + patients + pharmacists,
                    doctors,
                    patients,
                    pharmacists
                }
            },
            recentActivity
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;