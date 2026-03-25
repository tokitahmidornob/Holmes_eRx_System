const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');

// @route   POST /api/prescriptions
// @desc    Broadcast a new Master Prescription to the Grid
router.post('/', async (req, res) => {
    try {
        const { doctorId, patientId, medications, investigations, otp, broadcastId } = req.body;

        const newRx = new Prescription({
            doctorId,
            patientId,
            medications,
            investigations,
            otp,
            broadcastId
        });

        await newRx.save();
        res.status(201).json({ success: true, message: "Master Rx Secured in Vault", receipt: newRx });
        
    } catch (err) {
        console.error("Grid Error:", err);
        res.status(500).json({ error: "Failed to broadcast to the National Grid." });
    }
});

module.exports = router;