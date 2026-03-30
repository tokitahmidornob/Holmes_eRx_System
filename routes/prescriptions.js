const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Prescription, PractitionerRole } = require('../models/GridModels');

// ============================================================================
// 🛡️ SECURITY: JWT IDENTITY VERIFICATION
// ============================================================================
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: "Grid Access Denied." });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) { res.status(400).json({ msg: "Invalid Identity Token." }); }
};

// ============================================================================
// 🛡️ SECURITY: ENTERPRISE RBAC CLEARANCE
// ============================================================================
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                msg: `Clearance Denied. Access restricted to: ${allowedRoles.join(' or ').toUpperCase()}.` 
            });
        }
        next();
    };
};

// ==========================================
// 1. DOCTOR: SEAL & BROADCAST PAYLOAD
// ==========================================
router.post('/', verifyToken, requireRole('doctor'), async (req, res) => {
    try {
        const { patientId, medications, investigations } = req.body;
        if (!patientId || !medications || medications.length === 0) {
            return res.status(400).json({ msg: "Invalid Payload. Patient and Therapy required." });
        }

        const practitioner = await PractitionerRole.findOne({ personId: req.user.id });
        if (!practitioner) return res.status(404).json({ msg: "Practitioner authority not found." });

        const broadcastId = 'RX-' + crypto.randomBytes(2).toString('hex').toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const newRx = new Prescription({
            patientId: patientId,
            practitionerId: practitioner._id,
            medications: medications,
            investigations: investigations || [],
            broadcastId: broadcastId,
            otp: otp,
            status: 'Active'
        });

        await newRx.save();
        
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
// 2. DOCTOR: FETCH MASTER ARCHIVE
// ==========================================
router.get('/doctor/me', verifyToken, requireRole('doctor'), async (req, res) => {
    try {
        const practitioner = await PractitionerRole.findOne({ personId: req.user.id });
        if (!practitioner) return res.status(404).json({ msg: "Practitioner authority not found." });

        const history = await Prescription.find({ practitionerId: practitioner._id })
            .sort({ createdAt: -1 })
            .populate({
                path: 'patientId',
                populate: { path: 'personId', select: 'legalFullName gridId' }
            });

        const formattedHistory = history.map(rx => ({
            broadcastId: rx.broadcastId,
            otp: rx.otp,
            status: rx.status,
            createdAt: rx.createdAt,
            medications: rx.medications,
            investigations: rx.investigations,
            patientId: rx.patientId && rx.patientId.personId ? rx.patientId.personId.legalFullName : 'Unknown Citizen'
        }));

        res.json(formattedHistory);
    } catch (err) {
        console.error("ARCHIVE_SYNC_ERR:", err);
        res.status(500).json({ msg: "Grid Failure during Archive Sync." });
    }
});

// ==========================================
// 3. MULTI-AUTHORITY: DECRYPT PAYLOAD
// ==========================================
// 🚨 Notice the RBAC allows BOTH pharmacist and pathologist here
router.post('/decrypt', verifyToken, requireRole('pharmacist', 'pathologist'), async (req, res) => {
    try {
        const { broadcastId, otp } = req.body;
        
        const rx = await Prescription.findOne({ broadcastId: broadcastId.trim(), otp: otp.trim() })
            .populate({ path: 'patientId', populate: { path: 'personId', select: 'legalFullName' } })
            .populate({ path: 'practitionerId', populate: { path: 'personId', select: 'legalFullName' } });

        if (!rx) return res.status(404).json({ msg: "Grid Error: Payload Not Found or Invalid Keys." });
        
        // Dynamic Payload Filtering based on Authority
        let filteredData = {
            msg: "Decryption Successful.", 
            rxId: rx._id,
            status: rx.status,
            patientName: rx.patientId.personId.legalFullName,
            doctorName: rx.practitionerId.personId.legalFullName,
            date: rx.createdAt
        };

        if (req.user.role === 'pharmacist') {
            filteredData.medications = rx.medications;
        } else if (req.user.role === 'pathologist') {
            filteredData.investigations = rx.investigations;
        }

        res.json(filteredData);

    } catch (err) {
        console.error("DECRYPT_ERR:", err);
        res.status(500).json({ msg: "Grid Failure during decryption." });
    }
});

// ==========================================
// 4. PHARMACIST: DISPENSE PAYLOAD
// ==========================================
router.put('/dispense/:id', verifyToken, requireRole('pharmacist'), async (req, res) => {
    try {
        const rx = await Prescription.findById(req.params.id);
        if (!rx) return res.status(404).json({ msg: "Payload not found." });
        
        if (rx.status === 'Dispensed') return res.status(400).json({ msg: "CRITICAL: This payload has already been dispensed! Fraud detected." });

        rx.status = 'Dispensed'; 
        await rx.save();
        
        res.json({ msg: "Payload Dispensed and cryptographically locked in the Grid." });
    } catch (err) {
        res.status(500).json({ msg: "Grid Failure during dispensing." });
    }
});

module.exports = router;