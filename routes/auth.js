const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { Person, Patient, PractitionerRole } = require('../models/GridModels');

// ==========================================
// 1. INITIALIZE IDENTITY (Registration)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, dob, gender, phone } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ msg: 'Missing vital registration data.' });
        }

        let existingPerson = await Person.findOne({ loginIdentity: email });
        if (existingPerson) return res.status(400).json({ msg: 'Identity already exists in National Grid.' });

        const timestamp = Date.now().toString().slice(-6);
        const uuid = `BD-${new Date().getFullYear()}-${timestamp}`;

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newPerson = new Person({
            internalUuid: uuid,
            loginIdentity: email,
            password: hashedPassword,
            legalFullName: name,
            dateOfBirth: dob || new Date(), 
            genderLegal: gender || 'Other',
            contact: {
                primaryMobile: phone || '0000000000',
                primaryEmail: email
            },
            audit: { sourceOfTruth: 'Self_Registered_Portal' }
        });

        const savedPerson = await newPerson.save();

        if (role === 'patient') {
            await Patient.create({
                personId: savedPerson._id,
                enterpriseMrn: `MRN-${timestamp}`,
                nationalHealthId: `NHI-${uuid}`
            });
        } else {
            const roleTypeStr = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Doctor';
            await PractitionerRole.create({
                personId: savedPerson._id,
                roleType: roleTypeStr, 
                audit: { verificationStatus: 'Pending' }
            });
        }

        res.status(201).json({ msg: 'National Identity Initialized. Pending Verification.' });

    } catch (err) {
        console.error("AUTH_REGISTER_ERR:", err);
        res.status(500).json({ msg: 'Grid Initialization Failure: ' + err.message });
    }
});

// ==========================================
// 2. SECURE ACCESS TERMINAL (Login)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ msg: 'Email and Password are required.' });
        }

        const person = await Person.findOne({ loginIdentity: email });
        if (!person) return res.status(400).json({ msg: 'Invalid Grid Credentials.' });

        const isMatch = await bcrypt.compare(password, person.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Grid Credentials.' });

        // 🛡️ THE BULLETPROOF ROLE CHECK
        let userRole = 'patient';
        const checkPrac = await PractitionerRole.findOne({ personId: person._id });
        
        if (checkPrac) {
            // Safely default to 'Doctor' if roleType is somehow undefined in the DB
            userRole = (checkPrac.roleType || 'Doctor').toLowerCase();
        }

        const payload = {
            id: person._id,
            uuid: person.internalUuid,
            role: userRole,
            name: person.legalFullName
        };

        const secret = process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026';

        jwt.sign(payload, secret, { expiresIn: '12h' }, (err, token) => {
            if (err) {
                console.error("JWT_SIGN_ERR:", err);
                return res.status(500).json({ msg: 'Token Encryption Failed: ' + err.message });
            }
            res.json({ token, user: payload });
        });

    } catch (err) {
        console.error("LOGIN_CRASH:", err);
        res.status(500).json({ msg: 'Terminal Error: ' + err.message }); 
    }
});

module.exports = router;