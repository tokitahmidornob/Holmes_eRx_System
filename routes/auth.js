const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// 🌟 INJECTING THE NATIONAL GRID MODELS
const { Person, Patient, PractitionerRole } = require('../models/GridModels');

// ==========================================
// 1. INITIALIZE IDENTITY (Registration)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, dob, gender, phone } = req.body;

        // Step 1: Check if Identity already exists
        let existingPerson = await Person.findOne({ loginIdentity: email });
        if (existingPerson) return res.status(400).json({ msg: 'Identity already exists in National Grid.' });

        // Step 2: Create Universal UUID (e.g., BD-2026-XXXXX)
        const timestamp = Date.now().toString().slice(-6);
        const uuid = `BD-${new Date().getFullYear()}-${timestamp}`;

        // Step 3: Cryptographic Passphrase Hashing
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Step 4: Create the 'Person' (The Human Identity)
        const newPerson = new Person({
            internalUuid: uuid,
            loginIdentity: email,
            password: hashedPassword,
            legalFullName: name,
            dateOfBirth: dob || new Date(), // Required for National Grade
            genderLegal: gender || 'Other',
            contact: {
                primaryMobile: phone || '0000000000',
                primaryEmail: email
            },
            audit: { sourceOfTruth: 'Self_Registered_Portal' }
        });

        const savedPerson = await newPerson.save();

        // Step 5: Link the 'Role' (The Clinical Authority)
        if (role === 'patient') {
            await Patient.create({
                personId: savedPerson._id,
                enterpriseMrn: `MRN-${timestamp}`,
                nationalHealthId: `NHI-${uuid}`
            });
        } else {
            // Doctors, Pharmacists, Pathologists
            await PractitionerRole.create({
                personId: savedPerson._id,
                roleType: role.charAt(0).toUpperCase() + role.slice(1), // e.g. 'Doctor'
                audit: { verificationStatus: 'Pending' }
            });
        }

        res.status(201).json({ msg: 'National Identity Initialized. Pending Verification.' });

    } catch (err) {
        console.error("AUTH_ERR:", err);
        res.status(500).json({ msg: 'Grid Initialization Failure.' });
    }
});

// ==========================================
// 2. SECURE ACCESS TERMINAL (Login)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Step 1: Find the Person
        const person = await Person.findOne({ loginIdentity: email });
        if (!person) return res.status(400).json({ msg: 'Invalid Grid Credentials.' });

        // Step 2: Verify Hash
        const isMatch = await bcrypt.compare(password, person.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Grid Credentials.' });

        // Step 3: Determine Role via Relational Search
        let userRole = 'patient';
        const checkPrac = await PractitionerRole.findOne({ personId: person._id });
        if (checkPrac) userRole = checkPrac.roleType.toLowerCase();

        // Step 4: Sign JWT with National UUID
        const payload = {
            id: person._id,
            uuid: person.internalUuid,
            role: userRole,
            name: person.legalFullName
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: payload });
        });

    } catch (err) {
        res.status(500).json({ msg: 'Authentication Terminal Offline.' });
    }
});

module.exports = router;