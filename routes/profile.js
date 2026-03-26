const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Security Tripwire
const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied.' });
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        next();
    } catch (err) { res.status(401).json({ msg: 'Invalid Token.' }); }
};

// ==========================================
// GET CURRENT USER'S PROFILE
// ==========================================
router.get('/', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) { res.status(500).json({ msg: 'Server Error' }); }
});

// ==========================================
// UPDATE PROFILE & CALCULATE PROGRESS SCORE
// ==========================================
router.put('/', authenticate, async (req, res) => {
    try {
        let user = await User.findById(req.user.id);
        const data = req.body;

        // 1. Update Universal Core
        if(data.nationalId) user.nationalId = data.nationalId;
        if(data.phone) user.phone = data.phone;
        if(data.dateOfBirth) user.dateOfBirth = data.dateOfBirth;
        if(data.gender) user.gender = data.gender;

        // 2. Update Role-Specific Data & Calculate Score
        let score = 20; // Base score for having an account

        if (user.nationalId && user.phone) score += 30; // Universal data is worth 30%

        if (user.role === 'patient') {
            if(!user.patientProfile) user.patientProfile = {};
            user.patientProfile = { ...user.patientProfile, ...data.patientProfile };
            if (user.patientProfile.bloodGroup && user.patientProfile.emergencyContact?.phone) score += 50;
        } 
        else if (user.role === 'doctor') {
            if(!user.doctorProfile) user.doctorProfile = {};
            user.doctorProfile = { ...user.doctorProfile, ...data.doctorProfile };
            if (user.doctorProfile.bmdcNumber && user.doctorProfile.primarySpecialty) score += 50;
        }
        else if (user.role === 'pharmacist') {
            if(!user.pharmacistProfile) user.pharmacistProfile = {};
            user.pharmacistProfile = { ...user.pharmacistProfile, ...data.pharmacistProfile };
            if (user.pharmacistProfile.drugLicenseNumber && user.pharmacistProfile.tradeName) score += 50;
        }
        else if (user.role === 'pathologist') {
            if(!user.pathologistProfile) user.pathologistProfile = {};
            user.pathologistProfile = { ...user.pathologistProfile, ...data.pathologistProfile };
            if (user.pathologistProfile.dghsApprovalNumber && user.pathologistProfile.labName) score += 50;
        }

        user.profileCompletion = score > 100 ? 100 : score;
        await user.save();
        res.json({ msg: 'Profile Vault Updated', user });

    } catch (err) { 
        console.error(err);
        res.status(500).json({ msg: 'Server Error during update' }); 
    }
});

// ==========================================
// 🩺 DOCTOR PRIVILEGE: FETCH PATIENT PROFILE (For the Red Flag Snapshot)
// ==========================================
router.get('/patient/:email', authenticate, async (req, res) => {
    try {
        // Security: Only Doctors can do this
        if (req.user.role !== 'doctor') return res.status(403).json({msg: 'Unauthorized Clinical Access.'});
        
        const patient = await User.findOne({ email: req.params.email, role: 'patient' }).select('-password');
        if (!patient) return res.status(404).json({msg: 'Patient record not found in Grid.'});
        
        res.json(patient);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ msg: 'Server Error' }); 
    }
});

module.exports = router;