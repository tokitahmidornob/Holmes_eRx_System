const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');

// --- 1. DOCTOR: Issue Prescription ---
router.post('/issue', async (req, res) => {
    try {
        const { patientName, patientAge, patientGender, medicines, tests, doctorId, doctorName } = req.body;
        
        const rxId = 'RX-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const newPrescription = new Prescription({
            prescriptionId: rxId,
            otp: otp,
            doctorId: doctorId || 'UNKNOWN-DOC',
            doctorName: doctorName || 'Doctor',
            patientName, patientAge, patientGender, medicines,
            tests: tests || [] 
        });

        await newPrescription.save();
        res.status(201).json({ success: true, message: "Prescription secured!", rxId: rxId, otp: otp });
    } catch (error) {
        console.error("🔥 Issuance Database Error:", error);
        res.status(500).json({ success: false, error: "Database rejected the save operation: " + error.message });
    }
});

// --- 2. PHARMACIST: Verify & Load Prescription ---
router.post('/verify', async (req, res) => {
    try {
        const { rxId, otp } = req.body;
        const rx = await Prescription.findOne({ prescriptionId: rxId, otp: otp });

        if (!rx) return res.status(404).json({ success: false, error: "Invalid RX-ID or OTP." });
        if (rx.status === 'Fulfilled') return res.status(400).json({ success: false, error: "Alert: Prescription already fulfilled!" });

        res.status(200).json({ success: true, data: rx });
    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ success: false, error: "Server error during verification." });
    }
});

// --- 3. PHARMACIST: Fulfill & Close Record ---
router.post('/fulfill/:id', async (req, res) => {
    try {
        await Prescription.findByIdAndUpdate(req.params.id, { status: 'Fulfilled' });
        res.status(200).json({ success: true, message: "Medications dispensed successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fulfill." });
    }
});

// --- 4. PATIENT: Get Prescription History ---
router.get('/history/:patientName', async (req, res) => {
    try {
        const pName = decodeURIComponent(req.params.patientName);
        const rxList = await Prescription.find({ 
            patientName: new RegExp('^' + pName + '$', 'i') 
        }).sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: rxList });
    } catch (error) {
        console.error("History Fetch Error:", error);
        res.status(500).json({ success: false, error: "Failed to fetch patient history." });
    }
});

module.exports = router;