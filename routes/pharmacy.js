const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Prescription, Patient, Person, PractitionerRole } = require('../models/GridModels');

// 🔒 SECURITY TRIPWIRE
const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied. Terminal Unlinked.' });
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) { res.status(401).json({ msg: 'Invalid Grid Token.' }); }
};

/**
 * 🔓 DECRYPT PAYLOAD (Grid Broadcast ID + Patient OTP)
 * Logic: Pharmacist inputs the codes. If they match, the Grid yields the Rx details.
 */
router.post('/decrypt', authenticate, async (req, res) => {
    try {
        // Ensure only Pharmacists (or Doctors checking) can access the decryption terminal
        if (req.user.role !== 'pharmacist' && req.user.role !== 'doctor') {
            return res.status(403).json({ msg: 'Pharmacy Clearance Required.' });
        }

        const { broadcastId, otp } = req.body;

        if (!broadcastId || !otp) {
            return res.status(400).json({ msg: 'Broadcast ID and OTP are strictly required for decryption.' });
        }

        // 1. Locate the Encrypted Document
        const rx = await Prescription.findOne({ broadcastId: broadcastId.toUpperCase() })
            .populate({
                path: 'patientId',
                populate: { path: 'personId', select: 'legalFullName contact genderLegal dateOfBirth' }
            })
            .populate({
                path: 'practitionerRoleId',
                populate: { path: 'personId', select: 'legalFullName contact' }
            });

        if (!rx) return res.status(404).json({ msg: 'Payload not found on the National Grid.' });

        // 2. Cryptographic Check (OTP)
        if (rx.otp !== otp) {
            return res.status(401).json({ msg: 'OTP Mismatch. Decryption Halted.' });
        }

        // 3. Return the Decrypted Dossier
        res.json({
            _id: rx._id,
            broadcastId: rx.broadcastId,
            status: rx.status,
            issuedAt: rx.createdAt,
            medications: rx.medications,
            patientName: rx.patientId.personId.legalFullName,
            patientPhone: rx.patientId.personId.contact.primaryMobile,
            doctorName: rx.practitionerRoleId.personId.legalFullName
        });

    } catch (err) {
        console.error("DECRYPTION_ERR:", err);
        res.status(500).json({ msg: 'Grid Decryption Failure.' });
    }
});

/**
 * ✅ MARK AS DISPENSED (Sever the Chain of Custody)
 * Logic: Once handed over, the Rx is locked so it cannot be reused.
 */
router.post('/dispense/:rxId', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'pharmacist') return res.status(403).json({ msg: 'Pharmacy Clearance Required.' });

        const rx = await Prescription.findById(req.params.rxId);
        if (!rx) return res.status(404).json({ msg: 'Prescription not found.' });

        if (rx.status === 'Dispensed') {
            return res.status(400).json({ msg: 'FRAUD ALERT: This prescription has already been dispensed.' });
        }

        // Update the status
        rx.status = 'Dispensed';
        // (The logAudit middleware in server.js automatically records WHO dispensed it and WHEN)
        await rx.save();

        res.json({ msg: 'Prescription officially marked as Dispensed. Chain of custody severed.' });

    } catch (err) {
        console.error("DISPENSE_ERR:", err);
        res.status(500).json({ msg: 'Grid Update Failure.' });
    }
});

module.exports = router;