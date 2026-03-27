const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Prescription, Patient, PractitionerRole, Person, AllergyProfile } = require('../models/GridModels');

// 📦 IMPORT THE EMAIL GATEWAY
const { sendPrescriptionEmail } = require('../utils/mailer');

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
// 1. SEAL & BROADCAST PRESCRIPTION
// ==========================================
router.post('/', authenticate, async (req, res) => {
    try {
        const { patientId, medications, investigations } = req.body;

        // 1. Verify Practitioner Authority (Ministry Checked)
        const pracRole = await PractitionerRole.findOne({ personId: req.user.id });
        if (!pracRole || pracRole.audit.verificationStatus !== 'Verified') {
            return res.status(403).json({ msg: 'Your clinical credentials are pending verification. Prescribing is locked.' });
        }

        // 2. Locate Patient (Populate Person to get their Email Address)
        const targetPatient = await Patient.findById(patientId).populate('personId');
        if (!targetPatient) return res.status(404).json({ msg: 'Clinical Patient Record missing from Grid.' });

        // 3. THE CLINICAL CROSS-CHECK ENGINE (Contraindication Prevention)
        const patientAllergies = await AllergyProfile.find({ patientId: targetPatient._id });
        for (let med of medications) {
            for (let allergy of patientAllergies) {
                if (med.brandName.toLowerCase().includes(allergy.substance.toLowerCase()) || 
                    allergy.substance.toLowerCase().includes(med.brandName.toLowerCase())) {
                    return res.status(400).json({ 
                        msg: `CONTRAINDICATION: Patient is allergic to ${allergy.substance}. Prescription halted by Grid protocols.` 
                    });
                }
            }
        }

        // 4. Generate Cryptographic Keys
        const broadcastId = `RX-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 5. Seal Payload in Database
        const newRx = new Prescription({
            patientId: targetPatient._id,
            practitionerRoleId: pracRole._id,
            broadcastId,
            otp,
            medications,
            investigations,
            status: 'Active'
        });

        await newRx.save();

        // 🚀 6. FIRE THE EMAIL GATEWAY (Fire and Forget)
        const patientEmail = targetPatient.personId?.contact?.primaryEmail;
        if (patientEmail && patientEmail !== '0000000000') {
            // We do not await this, so the Doctor's terminal doesn't lag while the email sends
            sendPrescriptionEmail(patientEmail, broadcastId, otp, req.user.name).catch(err => console.error("Email dispatch failed:", err));
        }

        res.status(201).json({ 
            msg: 'Payload Sealed and Broadcasted.',
            broadcastId,
            otp
        });

    } catch (err) {
        console.error("RX_CREATE_ERR:", err);
        res.status(500).json({ msg: 'Grid Server Error.' });
    }
});

// ==========================================
// 2. FETCH DOCTOR'S ARCHIVE
// ==========================================
router.get('/doctor/me', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') return res.status(403).json({ msg: 'Doctor Clearance Required.' });
        
        const pracRole = await PractitionerRole.findOne({ personId: req.user.id });
        if (!pracRole) return res.json([]);

        const history = await Prescription.find({ practitionerRoleId: pracRole._id })
            .populate({
                path: 'patientId',
                populate: { path: 'personId', select: 'legalFullName' }
            })
            .sort({ createdAt: -1 });

        const mappedHistory = history.map(rx => ({
            _id: rx._id,
            broadcastId: rx.broadcastId,
            otp: rx.otp,
            patientId: rx.patientId?.personId?.legalFullName || 'Unknown Patient',
            status: rx.status,
            createdAt: rx.createdAt,
            medications: rx.medications,
            investigations: rx.investigations
        }));

        res.json(mappedHistory);
    } catch (err) {
        console.error("RX_DOCTOR_HISTORY_ERR:", err);
        res.status(500).json({ msg: 'Vault Unreachable.' });
    }
});

// ==========================================
// 3. FETCH CITIZEN'S VAULT (Patient Archive)
// ==========================================
router.get('/patient/me', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'patient') return res.status(403).json({ msg: 'Citizen Clearance Required.' });
        
        const targetPatient = await Patient.findOne({ personId: req.user.id });
        if (!targetPatient) return res.json([]);

        const history = await Prescription.find({ patientId: targetPatient._id })
            .populate({
                path: 'practitionerRoleId',
                populate: { path: 'personId', select: 'legalFullName' }
            })
            .sort({ createdAt: -1 });

        const mappedHistory = history.map(rx => ({
            _id: rx._id,
            broadcastId: rx.broadcastId,
            otp: rx.otp,
            doctorName: rx.practitionerRoleId?.personId?.legalFullName ? `Dr. ${rx.practitionerRoleId.personId.legalFullName}` : 'Unknown Doctor',
            status: rx.status,
            createdAt: rx.createdAt,
            medications: rx.medications,
            investigations: rx.investigations
        }));

        res.json(mappedHistory);
    } catch (err) {
        console.error("RX_PATIENT_HISTORY_ERR:", err);
        res.status(500).json({ msg: 'Vault Unreachable.' });
    }
});

module.exports = router;