const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Patient, PractitionerRole, AllergyProfile, ConditionProfile, MedicationProfile } = require('./models/GridModels');

// 🔒 SECURITY TRIPWIRE
const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied. Terminal Unlinked.' });
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        next();
    } catch (err) { res.status(401).json({ msg: 'Invalid Grid Token.' }); }
};

/**
 * ⚠️ ADD ALLERGY (FHIR: AllergyIntolerance)
 * Logic: Can be self-reported by Patient or clinically asserted by Doctor.
 */
router.post('/allergies', authenticate, async (req, res) => {
    try {
        const { targetPatientId, substance, criticality } = req.body;
        
        // Determine the Patient ID (If user is a patient, they are the target. If doctor, they provide the target)
        let actualPatientId = req.user.role === 'patient' ? null : targetPatientId;
        
        if (req.user.role === 'patient') {
            const myPatientRecord = await Patient.findOne({ personId: req.user.id });
            actualPatientId = myPatientRecord._id;
        }

        if (!actualPatientId) return res.status(400).json({ msg: 'Target Patient ID required.' });

        // Create the Independent FHIR Resource
        const newAllergy = new AllergyProfile({
            patientId: actualPatientId,
            substance: substance,
            criticality: criticality || 'Unable_to_Assess',
            verificationStatus: req.user.role === 'doctor' ? 'Confirmed' : 'Unconfirmed',
            audit: { sourceOfTruth: req.user.role === 'doctor' ? 'Clinical_Assertion' : 'Patient_Self_Report' }
        });

        const savedAllergy = await newAllergy.save();

        // Relational Linking: Attach this new document to the Patient's Safety Anchors
        await Patient.findByIdAndUpdate(actualPatientId, {
            $push: { 'safetyAnchors.allergyRefs': savedAllergy._id }
        });

        res.status(201).json({ msg: 'Allergy Recorded in Clinical Vault.', allergy: savedAllergy });

    } catch (err) {
        console.error("ALLERGY_ERR:", err);
        res.status(500).json({ msg: 'Clinical Vault Error.' });
    }
});

/**
 * 🫀 ADD CHRONIC CONDITION (FHIR: Condition)
 */
router.post('/conditions', authenticate, async (req, res) => {
    try {
        const { targetPatientId, name, conditionType } = req.body;
        
        let actualPatientId = req.user.role === 'patient' ? null : targetPatientId;
        if (req.user.role === 'patient') {
            const myPatientRecord = await Patient.findOne({ personId: req.user.id });
            actualPatientId = myPatientRecord._id;
        }

        let asserterId = null;
        if (req.user.role === 'doctor') {
            const pracRole = await PractitionerRole.findOne({ personId: req.user.id });
            asserterId = pracRole ? pracRole._id : null;
        }

        const newCondition = new ConditionProfile({
            patientId: actualPatientId,
            name: name,
            conditionType: conditionType || 'Chronic',
            clinicalStatus: 'Active',
            recordedDate: Date.now(),
            asserter: asserterId,
            audit: { sourceOfTruth: req.user.role === 'doctor' ? 'Clinical_Assertion' : 'Patient_Self_Report' }
        });

        const savedCondition = await newCondition.save();

        await Patient.findByIdAndUpdate(actualPatientId, {
            $push: { 'safetyAnchors.conditionRefs': savedCondition._id }
        });

        res.status(201).json({ msg: 'Condition Recorded in Clinical Vault.', condition: savedCondition });

    } catch (err) {
        res.status(500).json({ msg: 'Clinical Vault Error.' });
    }
});

/**
 * 📂 FETCH COMPLETE CLINICAL DOSSIER
 * Logic: Pulls all Allergies, Conditions, and Meds for a given Patient ID.
 */
router.get('/dossier/:patientId', authenticate, async (req, res) => {
    try {
        const { patientId } = req.params;

        // Security: Ensure a patient isn't trying to fetch another patient's dossier
        if (req.user.role === 'patient') {
            const myPatientRecord = await Patient.findOne({ personId: req.user.id });
            if (myPatientRecord._id.toString() !== patientId) {
                return res.status(403).json({ msg: 'HIPAA Violation: Cannot access external clinical records.' });
            }
        } else if (req.user.role !== 'doctor') {
            return res.status(403).json({ msg: 'Clinical Clearance Required.' });
        }

        // Fetch independent resources
        const allergies = await AllergyProfile.find({ patientId });
        const conditions = await ConditionProfile.find({ patientId });
        const medications = await MedicationProfile.find({ patientId, status: 'Active' });

        res.json({
            allergies,
            conditions,
            activeMedications: medications
        });

    } catch (err) {
        res.status(500).json({ msg: 'Dossier Retrieval Failure.' });
    }
});

module.exports = router;