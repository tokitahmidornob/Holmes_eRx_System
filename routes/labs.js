const express = require('express');
const router = express.Router();
const LabReport = require('../models/LabReport');
const { Prescription } = require('../models/GridModels');
const jwt = require('jsonwebtoken');

// Security Tripwire
const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied.' });
    try {
        const token = authHeader.split(' ')[1];
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Invalid Token.' });
    }
};

// ==========================================
// 🔬 PATHOLOGIST: UPLOAD NEW LAB REPORT
// ==========================================
router.post('/', authenticate, async (req, res) => {
    try {
        const { prescriptionId, testName, resultValue, unit, referenceRange, pdfReport } = req.body;

        // 🔍 Detective Work: Find the original prescription to link the Doctor and Patient
        const originalRx = await Prescription.findById(prescriptionId);
        if (!originalRx) {
            return res.status(404).json({ msg: "Fatal Error: Original Prescription not found in Grid." });
        }

        const newReport = new LabReport({
            prescriptionId: originalRx._id,
            patientId: originalRx.patientId,          // Linked automatically!
            doctorId: originalRx.doctorId,            // Linked automatically!
            pathologistId: req.user.id,               // Grabbed from Pathologist's login token!
            testName,
            resultValue,
            unit: unit || 'N/A',
            referenceRange: referenceRange || 'N/A',
            pdfReport                                 // The Base64 PDF String
        });

        const savedReport = await newReport.save();
        res.status(201).json(savedReport);
    } catch (err) {
        console.error("Lab Upload Error:", err);
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 🩺 DOCTOR/PATIENT: FETCH LABS FOR A SPECIFIC RX
// ==========================================
router.get('/prescription/:rxId', authenticate, async (req, res) => {
    try {
        const labs = await LabReport.find({ prescriptionId: req.params.rxId })
            .populate('pathologistId', 'name') // Pulls the Pathologist's name for the Doctor to see
            .sort({ createdAt: -1 });
        res.json(labs);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

module.exports = router;