const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Patient, PractitionerRole, Prescription, AllergyProfile, MedicationProfile, AuditEvent } = require('../models/GridModels');

// 🔒 SECURITY TRIPWIRE
const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied.' });
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        next();
    } catch (err) { res.status(401).json({ msg: 'Invalid Token.' }); }
};

/**
 * 🚀 GENERATE & BROADCAST PRESCRIPTION
 * Logic: Cross-checks allergies, seals the document, and opens active FHIR medication profiles.
 */
router.post('/', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') return res.status(403).json({ msg: 'Clinical Authority Required.' });

        const { patientId, medications, investigations } = req.body; // Note: Frontend now sends the Patient's _id or email. We must adapt.

        // 1. Verify Practitioner Authority
        const pracRole = await PractitionerRole.findOne({ personId: req.user.id });
        if (!pracRole || pracRole.audit.verificationStatus !== 'Verified') {
            return res.status(403).json({ msg: 'Your clinical credentials are pending verification. Prescribing is locked.' });
        }

        // 2. Locate the Patient (Frontend currently sends email, so we find Person, then Patient)
        const { Person } = require('../models/GridModels');
        const targetPerson = await Person.findOne({ loginIdentity: patientId });
        if (!targetPerson) return res.status(404).json({ msg: 'Citizen not found.' });
        
        const targetPatient = await Patient.findOne({ personId: targetPerson._id });
        if (!targetPatient) return res.status(404).json({ msg: 'Clinical Patient Record missing.' });

        // 🚨 3. THE CLINICAL CROSS-CHECK ENGINE (Fatal Interaction Prevention)
        const patientAllergies = await AllergyProfile.find({ patientId: targetPatient._id });
        
        for (let med of medications) {
            for (let allergy of patientAllergies) {
                // If the prescribed drug name contains the allergic substance
                if (med.brandName.toLowerCase().includes(allergy.substance.toLowerCase())) {
                    return res.status(400).json({ 
                        msg: `CONTRAINDICATION BLOCKED: Patient has a recorded allergy to ${allergy.substance.toUpperCase()}. Prescription of ${med.brandName} is legally prohibited.` 
                    });
                }
            }
        }

        // 4. Generate Cryptographic Identifiers
        const broadcastId = `RX-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit pin

        // 5. Forge the Master Prescription Document
        const newPrescription = new Prescription({
            patientId: targetPatient._id,
            practitionerRoleId: pracRole._id,
            broadcastId,
            otp,
            medications,
            investigations,
            audit: { sourceOfTruth: 'Clinical_Pad_Terminal' }
        });

        const savedRx = await newPrescription.save();

        // 6. Update the Patient's Active Medication Profiles (FHIR compliance)
        for (let med of medications) {
            await MedicationProfile.create({
                patientId: targetPatient._id,
                brandName: med.brandName,
                status: 'Active',
                authoredBy: pracRole._id,
                audit: { sourceOfTruth: 'E_Prescription_Event' }
            });
        }

        res.status(201).json({ 
            msg: 'Prescription Encrypted & Broadcasted to National Grid.',
            broadcastId: savedRx.broadcastId,
            otp: savedRx.otp,
            _id: savedRx._id
        });

    } catch (err) {
        console.error("RX_BROADCAST_ERR:", err);
        res.status(500).json({ msg: 'Grid Broadcast Failure.' });
    }
});

/**
 * 🗄️ FETCH DOCTOR'S ARCHIVE (Master Rx History)
 */
router.get('/doctor/:doctorId', authenticate, async (req, res) => {
    try {
        const pracRole = await PractitionerRole.findOne({ personId: req.user.id });
        if (!pracRole) return res.json([]);

        // Populate the Patient's Person data to display their name on the UI
        const history = await Prescription.find({ practitionerRoleId: pracRole._id })
            .populate({
                path: 'patientId',
                populate: { path: 'personId', select: 'legalFullName loginIdentity' }
            })
            .sort({ createdAt: -1 });

        // Map it back to the format the frontend UI expects
        const mappedHistory = history.map(rx => ({
            _id: rx._id,
            broadcastId: rx.broadcastId,
            otp: rx.otp,
            patientId: rx.patientId?.personId?.legalFullName || 'Unknown Citizen',
            status: rx.status,
            createdAt: rx.createdAt,
            medications: rx.medications,
            investigations: rx.investigations
        }));

        res.json(mappedHistory);
    } catch (err) {
        console.error("RX_HISTORY_ERR:", err);
        res.status(500).json({ msg: 'Archive Unreachable.' });
    }
});

module.exports = router;