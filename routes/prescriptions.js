const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Prescription, Patient, PractitionerRole, Person } = require('../models/GridModels');

// Cryptographic Middleware
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: "Grid Access Denied." });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) { res.status(400).json({ msg: "Invalid Identity Token." }); }
};

// ==========================================
// 1. SEAL & BROADCAST PAYLOAD (POST)
// ==========================================
router.post('/', verifyToken, async (req, res) => {
    try {
        // Only Doctors can broadcast
        if (req.user.role !== 'doctor') return res.status(403).json({ msg: "Unauthorized. Only Practitioners can formulate payloads." });

        const { patientId, medications, investigations } = req.body;
        if (!patientId || !medications || medications.length === 0) {
            return res.status(400).json({ msg: "Invalid Payload. Patient and Therapy required." });
        }

        // 1. Find the Doctor's Practitioner Profile
        const practitioner = await PractitionerRole.findOne({ personId: req.user.id });
        if (!practitioner) return res.status(404).json({ msg: "Practitioner authority not found." });

        // 2. Generate Cryptographic Keys
        // Broadcast ID (e.g., RX-A7B9-C123)
        const broadcastId = 'RX-' + crypto.randomBytes(2).toString('hex').toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
        
        // Decryption OTP (6 digit number)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 3. Seal the Prescription in the Master Schema
        const newRx = new Prescription({
            patientId: patientId, // This is the Patient's ObjectId
            practitionerId: practitioner._id,
            medications: medications,
            investigations: investigations || [],
            broadcastId: broadcastId,
            otp: otp,
            status: 'Active'
        });

        await newRx.save();

        // 🚨 NOTE FOR LATER: We will plug the NodeMailer email trigger in right here!
        
        // 4. Return the keys to the Doctor's Terminal
        res.status(201).json({ 
            msg: "Payload Sealed Successfully.", 
            broadcastId: broadcastId, 
            otp: otp 
        });

    } catch (err) {
        console.error("PRESCRIPTION_SEAL_ERR:", err);
        res.status(500).json({ msg: "Grid Failure during Payload Encryption." });
    }
});

// ==========================================
// 2. FETCH MASTER ARCHIVE (GET)
// ==========================================
// This powers the "Master Archive" tab on your dashboard!
router.get('/doctor/me', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') return res.status(403).json({ msg: "Unauthorized." });

        const practitioner = await PractitionerRole.findOne({ personId: req.user.id });
        if (!practitioner) return res.status(404).json({ msg: "Practitioner authority not found." });

        // Fetch all prescriptions written by this doctor, newest first
        const history = await Prescription.find({ practitionerId: practitioner._id })
            .sort({ createdAt: -1 })
            .populate({
                path: 'patientId',
                populate: { path: 'personId', select: 'legalFullName gridId' }
            });

        // Format the data perfectly for the frontend
        const formattedHistory = history.map(rx => ({
            broadcastId: rx.broadcastId,
            otp: rx.otp,
            status: rx.status,
            createdAt: rx.createdAt,
            medications: rx.medications,
            investigations: rx.investigations,
            // Safely grab the patient's name
            patientId: rx.patientId && rx.patientId.personId ? rx.patientId.personId.legalFullName : 'Unknown Citizen'
        }));

        res.json(formattedHistory);
    } catch (err) {
        console.error("ARCHIVE_SYNC_ERR:", err);
        res.status(500).json({ msg: "Grid Failure during Archive Sync." });
    }
});

// ==========================================
// 3. PHARMACIST: DECRYPT PAYLOAD
// ==========================================
router.post('/decrypt', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'pharmacist') return res.status(403).json({ msg: "Clearance Denied. Pharmacist access required." });
        
        const { broadcastId, otp } = req.body;
        
        // Search for the precise cryptographic match
        const rx = await Prescription.findOne({ broadcastId: broadcastId.trim(), otp: otp.trim() })
            .populate({ path: 'patientId', populate: { path: 'personId', select: 'legalFullName' } })
            .populate({ path: 'practitionerId', populate: { path: 'personId', select: 'legalFullName' } });

        if (!rx) return res.status(404).json({ msg: "Grid Error: Payload Not Found or Invalid Decryption Keys." });
        
        res.json({ 
            msg: "Decryption Successful.", 
            rxId: rx._id,
            status: rx.status,
            patientName: rx.patientId.personId.legalFullName,
            doctorName: rx.practitionerId.personId.legalFullName,
            medications: rx.medications,
            date: rx.createdAt
        });

    } catch (err) {
        res.status(500).json({ msg: "Grid Failure during decryption." });
    }
});

// ==========================================
// 4. PHARMACIST: DISPENSE PAYLOAD
// ==========================================
router.put('/dispense/:id', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'pharmacist') return res.status(403).json({ msg: "Clearance Denied." });
        
        const rx = await Prescription.findById(req.params.id);
        if (!rx) return res.status(404).json({ msg: "Payload not found." });
        
        // Anti-Fraud Check
        if (rx.status === 'Dispensed') return res.status(400).json({ msg: "CRITICAL: This payload has already been dispensed! Fraud detected." });

        rx.status = 'Dispensed'; // Lock the payload permanently
        await rx.save();
        
        res.json({ msg: "Payload Dispensed and cryptographically locked in the Grid." });
    } catch (err) {
        res.status(500).json({ msg: "Grid Failure during dispensing." });
    }
});

module.exports = router;