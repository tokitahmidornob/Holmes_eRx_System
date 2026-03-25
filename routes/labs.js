const express = require('express');
const router = express.Router();
const LabReport = require('../models/LabReport');

// @route   POST /api/labs/upload
// @desc    Pathologist uploads a completed lab report
router.post('/upload', async (req, res) => {
    try {
        const { prescriptionId, patientId, doctorId, pathologistId, testName, resultValue, unit, referenceRange, clinicalNotes } = req.body;
        
        const newReport = new LabReport({
            prescriptionId, patientId, doctorId, pathologistId, 
            testName, resultValue, unit, referenceRange, clinicalNotes
        });

        await newReport.save();
        res.status(201).json({ success: true, report: newReport });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to upload to the National Grid." });
    }
});

// @route   GET /api/labs/prescription/:rxId
// @desc    Get all lab reports attached to a specific prescription
router.get('/prescription/:rxId', async (req, res) => {
    try {
        const reports = await LabReport.find({ prescriptionId: req.params.rxId })
            .populate('pathologistId', 'name');
        res.json(reports);
    } catch (err) { res.status(500).json({ error: "Fetch failed." }); }
});

module.exports = router;