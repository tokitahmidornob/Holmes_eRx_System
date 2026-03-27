const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Person, Patient, PractitionerRole } = require('../models/GridModels');

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
// 1. FETCH IDENTITY DOSSIER
// ==========================================
router.get('/', authenticate, async (req, res) => {
    try {
        const person = await Person.findById(req.user.id);
        if (!person) return res.status(404).json({ msg: 'Identity not found in National Grid.' });

        let roleSpecificData = {};
        let profileCompletion = 50; // Base completion

        if (req.user.role === 'patient') {
            const pat = await Patient.findOne({ personId: person._id });
            roleSpecificData = pat ? { nhi: pat.nationalHealthId, nid: pat.nationalId || '' } : {};
            if (pat && pat.nationalId && person.contact.primaryMobile !== '0000000000') profileCompletion = 100;
        } else {
            const prac = await PractitionerRole.findOne({ personId: person._id });
            roleSpecificData = prac ? { license: prac.licenseNumber || '', status: prac.audit.verificationStatus } : {};
            if (prac && prac.licenseNumber && person.contact.primaryMobile !== '0000000000') profileCompletion = 100;
        }

        res.json({
            person: {
                name: person.legalFullName,
                email: person.contact.primaryEmail,
                phone: person.contact.primaryMobile === '0000000000' ? '' : person.contact.primaryMobile,
                dob: person.dateOfBirth ? new Date(person.dateOfBirth).toISOString().split('T')[0] : '',
                gender: person.genderLegal
            },
            roleData: roleSpecificData,
            profileCompletion
        });
    } catch (err) {
        console.error("PROFILE_FETCH_ERR:", err);
        res.status(500).json({ msg: 'Grid Server Error.' });
    }
});

// ==========================================
// 2. UPDATE IDENTITY MATRIX
// ==========================================
router.put('/update', authenticate, async (req, res) => {
    try {
        const { phone, dob, gender, professionalLicense, nationalId } = req.body;
        
        // 1. Update Core Demographics
        const person = await Person.findById(req.user.id);
        if (phone) person.contact.primaryMobile = phone;
        if (dob) person.dateOfBirth = dob;
        if (gender) person.genderLegal = gender;
        await person.save();

        // 2. Update Role-Specific Authority
        if (req.user.role === 'patient' && nationalId) {
            await Patient.findOneAndUpdate({ personId: person._id }, { nationalId: nationalId });
        } else if ((req.user.role === 'doctor' || req.user.role === 'pharmacist') && professionalLicense) {
            await PractitionerRole.findOneAndUpdate(
                { personId: person._id }, 
                { licenseNumber: professionalLicense, 'audit.verificationStatus': 'Pending Ministry Verification' }
            );
        }

        res.json({ msg: 'Identity Matrix Updated Successfully. Cryptographic Hash Secured.' });
    } catch (err) {
        console.error("PROFILE_UPDATE_ERR:", err);
        res.status(500).json({ msg: 'Failed to update Grid Identity.' });
    }
});

module.exports = router;