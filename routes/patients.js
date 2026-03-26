const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Person, Patient, PractitionerRole } = require('./models/GridModels');

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
 * 🪪 VIEW MY CITIZEN RECORD
 * Logic: Allows a patient to view their combined Universal Identity and FHIR Patient Record.
 */
router.get('/my-record', authenticate, async (req, res) => {
    try {
        // Only patients can access their own root record this way
        if (req.user.role !== 'patient') return res.status(403).json({ msg: 'Invalid Role Scope.' });

        const person = await Person.findById(req.user.id).select('-password');
        const patient = await Patient.findOne({ personId: req.user.id })
            .populate('careTeam.primaryDoctorId', 'legalFullName')
            .populate('preferredPharmacy', 'orgName');

        if (!patient) return res.status(404).json({ msg: 'Citizen Record Not Found.' });

        res.json({ person, patient });
    } catch (err) {
        res.status(500).json({ msg: 'Grid Directory Unreachable.' });
    }
});

/**
 * 🔄 UPDATE CITIZEN DEMOGRAPHICS
 * Logic: Updates emergency contacts, insurance, and blood group.
 */
router.put('/update', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'patient') return res.status(403).json({ msg: 'Invalid Role Scope.' });

        const { bloodGroup, emergencyName, emergencyRelation, emergencyPhone, payerName, membershipId } = req.body;

        const patient = await Patient.findOne({ personId: req.user.id });
        if (!patient) return res.status(404).json({ msg: 'Citizen Record Not Found.' });

        // Update Safety Anchors & Emergency
        if (bloodGroup) {
            patient.safetyAnchors = patient.safetyAnchors || {};
            patient.safetyAnchors.bloodGroup = bloodGroup;
        }
        
        patient.emergencyContact = {
            name: emergencyName || patient.emergencyContact?.name,
            relation: emergencyRelation || patient.emergencyContact?.relation,
            phone: emergencyPhone || patient.emergencyContact?.phone
        };

        // Update Insurance details
        patient.insuranceDetails = {
            payerName: payerName || patient.insuranceDetails?.payerName,
            membershipId: membershipId || patient.insuranceDetails?.membershipId
        };

        await patient.save();

        res.json({ msg: 'Citizen Record Synchronized.', patient });

    } catch (err) {
        console.error("CITIZEN_UPDATE_ERR:", err);
        res.status(500).json({ msg: 'Synchronization Failure.' });
    }
});

/**
 * 🔍 NATIONAL DIRECTORY SEARCH (DOCTOR PRIVILEGE)
 * Logic: Allows a verified doctor to search for a patient by NID, NHI, or Phone.
 */
router.post('/search', authenticate, async (req, res) => {
    try {
        // 1. Verify the requester is an active Practitioner
        const pracRole = await PractitionerRole.findOne({ personId: req.user.id });
        if (!pracRole || pracRole.audit.verificationStatus !== 'Verified') {
            return res.status(403).json({ msg: 'Clinical Clearance Required to search National Registry.' });
        }

        const { query } = req.body; // Can be a phone number, NID, or exact NHI

        // 2. Search the Person Vault first (for Phone or NID)
        const persons = await Person.find({
            $or: [
                { nationalId: query },
                { 'contact.primaryMobile': query },
                { loginIdentity: query.toLowerCase() }
            ]
        });

        const personIds = persons.map(p => p._id);

        // 3. Search the Patient Vault (combining Person results + NHI/MRN direct searches)
        const patients = await Patient.find({
            $or: [
                { personId: { $in: personIds } },
                { nationalHealthId: query },
                { enterpriseMrn: query }
            ]
        }).populate('personId', 'legalFullName contact.primaryMobile genderLegal dateOfBirth');

        // Map data to a clean, read-only format for the Doctor's search results
        const searchResults = patients.map(pat => ({
            patientId: pat._id,
            nhi: pat.nationalHealthId,
            mrn: pat.enterpriseMrn,
            name: pat.personId.legalFullName,
            phone: pat.personId.contact.primaryMobile,
            gender: pat.personId.genderLegal,
            age: new Date().getFullYear() - new Date(pat.personId.dateOfBirth).getFullYear()
        }));

        res.json(searchResults);

    } catch (err) {
        console.error("GRID_SEARCH_ERR:", err);
        res.status(500).json({ msg: 'National Directory Unreachable.' });
    }
});

module.exports = router;