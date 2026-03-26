const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 🌟 INJECTING THE NEW MASTER ARCHITECTURE 🌟
const { Person, Patient, PractitionerRole } = require('../models/GridModels');

// ==========================================
// 1. INITIALIZE IDENTITY (Registration)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Step 1: Check if the human already exists in the Grid
        let existingPerson = await Person.findOne({ loginIdentity: email });
        if (existingPerson) {
            return res.status(400).json({ msg: 'Identity already registered in the National Grid.' });
        }

        // Step 2: Cryptographic Hashing
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Step 3: Generate the Enterprise UUID
        const prefix = role.substring(0, 2).toUpperCase(); // e.g., 'PA' for patient, 'DO' for doctor
        const uniqueId = `HOLMES-${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;

        // Step 4: Create the Universal Person Record
        const newPerson = new Person({
            internalUuid: uniqueId,
            loginIdentity: email,
            password: hashedPassword,
            legalFullName: name,
            security: { accountStatus: 'Pending Verification' }
        });
        const savedPerson = await newPerson.save();

        // Step 5: Wire up the Relational Role Vault
        if (role === 'patient') {
            const newPatient = new Patient({
                personId: savedPerson._id,
                enterpriseMrn: uniqueId
            });
            await newPatient.save();
        } else {
            // For Doctors, Pharmacists, and Pathologists
            const formattedRole = role.charAt(0).toUpperCase() + role.slice(1); // e.g., 'Doctor'
            const newPractitioner = new PractitionerRole({
                personId: savedPerson._id,
                roleType: formattedRole
            });
            await newPractitioner.save();
        }

        res.status(201).json({ msg: 'Identity Initialized successfully.' });
    } catch (err) {
        console.error("Auth Engine Error:", err);
        res.status(500).json({ msg: 'Server Error during initialization.' });
    }
});

// ==========================================
// 2. SECURE ACCESS TERMINAL (Login)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // Step 1: Locate the Human
        const person = await Person.findOne({ loginIdentity: email });
        if (!person) return res.status(400).json({ msg: 'Invalid Credentials.' });

        // Step 2: Verify Cryptographic Signature
        const isMatch = await bcrypt.compare(password, person.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials.' });

        // Step 3: Cross-Check Relational Role
        let verifiedRole = '';
        const patientRecord = await Patient.findOne({ personId: person._id });
        
        if (patientRecord) {
            verifiedRole = 'patient';
        } else {
            const pracRecord = await PractitionerRole.findOne({ personId: person._id });
            if (pracRecord) verifiedRole = pracRecord.roleType.toLowerCase();
        }

        // Security Tripwire: Ensure they are logging into the correct portal
        if (verifiedRole !== role) {
            return res.status(403).json({ msg: `Access Denied: You are registered as a ${verifiedRole}, not a ${role}.` });
        }

        // Step 4: Forge the JWT Token
        const payload = {
            id: person._id,
            name: person.legalFullName,
            role: verifiedRole,
            gridId: person.internalUuid
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: payload });
        });

    } catch (err) {
        console.error("Login Engine Error:", err);
        res.status(500).json({ msg: 'Server Error during authentication.' });
    }
});

// ==========================================
// 3. DOCTOR PRIVILEGE: FETCH CITIZENS
// ==========================================
// This has been upgraded to populate data across the new relational schemas
router.get('/patients', async (req, res) => {
    try {
        // Verify Auth Header
        const authHeader = req.header('Authorization');
        if (!authHeader) return res.status(401).json({ msg: 'No token, authorization denied' });
        jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);

        // Fetch all Patient records, and pull in their Universal Identity (Person) data
        const patients = await Patient.find().populate('personId', 'legalFullName loginIdentity internalUuid');
        
        // Map the complex FHIR data back into the simple format the Doctor Pad expects
        const formattedPatients = patients.map(p => ({
            email: p.personId.loginIdentity,
            name: p.personId.legalFullName,
            gridId: p.personId.internalUuid
        }));

        res.json(formattedPatients);
    } catch (err) {
        console.error("Patient Fetch Error:", err);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;