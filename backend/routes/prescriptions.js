const express = require('express');
const router = require('express').Router();
const Prescription = require('../models/Prescription');
const User = require('../models/User'); // 👈 THIS WAS LIKELY MISSING

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

// @route   GET /api/prescriptions/patient/:patientEmailOrId
// @desc    Get all prescriptions for a specific patient's Health Vault
router.get('/patient/:patientId', async (req, res) => {
    try {
        const rxList = await Prescription.find({ patientId: req.params.patientId })
            .populate('doctorId', 'name department')
            .sort({ createdAt: -1 }); // Newest first
        res.json(rxList);
    } catch (err) {
        res.status(500).json({ error: "Failed to access Health Vault." });
    }
});

module.exports = router;