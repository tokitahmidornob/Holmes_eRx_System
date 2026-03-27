const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Person, Patient, PractitionerRole } = require('../models/GridModels');

// ==========================================
// 1. REGISTER NEW GRID IDENTITY
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // 1. Check if Identity already exists
        let person = await Person.findOne({ loginIdentity: email });
        if (person) return res.status(400).json({ msg: 'Identity already exists in the Grid.' });

        // 2. Cryptographically Hash Password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 3. Create Core Person Document
        person = new Person({
            loginIdentity: email,
            passwordHash: passwordHash, // Fixed to match GridModels
            legalFullName: name,
            contact: { primaryEmail: email, primaryMobile: '0000000000' }
        });
        await person.save();

        // 4. Create Role-Specific Profile
        if (role === 'patient') {
            const patient = new Patient({ personId: person._id });
            await patient.save();
        } else {
            // Map frontend role to Backend Enum
            const roleMapping = {
                'doctor': 'Doctor',
                'pharmacist': 'Pharmacist',
                'pathologist': 'Pathologist',
                'admin': 'Admin'
            };
            const pracRole = new PractitionerRole({
                personId: person._id,
                roleType: roleMapping[role] || 'Doctor'
            });
            await pracRole.save();
        }

        res.status(201).json({ msg: 'Identity Initialized.' });
    } catch (err) {
        console.error("REGISTER_ERR:", err);
        res.status(500).json({ msg: 'Grid Server Error during registration.' });
    }
});

// ==========================================
// 2. AUTHENTICATE & LOGIN
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // 1. Find Core Identity
        const person = await Person.findOne({ loginIdentity: email });
        if (!person) return res.status(400).json({ msg: 'Invalid Credentials.' });

        // 2. Verify Cryptographic Passphrase
        // 🚨 This fixes the "Undefined" error by targeting passwordHash
        const isMatch = await bcrypt.compare(password, person.passwordHash);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials.' });

        // 3. Verify the user is logging into the correct Role Terminal
        if (role === 'patient') {
            const pat = await Patient.findOne({ personId: person._id });
            if (!pat) return res.status(403).json({ msg: 'Identity is not registered as a Citizen.' });
        } else {
            const roleMapping = {
                'doctor': 'Doctor',
                'pharmacist': 'Pharmacist',
                'pathologist': 'Pathologist',
                'admin': 'Admin'
            };
            const prac = await PractitionerRole.findOne({ personId: person._id, roleType: roleMapping[role] });
            if (!prac) return res.status(403).json({ msg: `Identity is not registered as a ${roleMapping[role]}.` });
        }

        // 4. Generate JWT Security Token
        const payload = {
            id: person._id,
            name: person.legalFullName,
            role: role 
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026',
            { expiresIn: '12h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: payload });
            }
        );
    } catch (err) {
        console.error("LOGIN_ERR:", err);
        res.status(500).json({ msg: 'Grid Server Error during login.' });
    }
});

// ==========================================
// ☢️ TEMPORARY CLOUD PURGE (DELETE AFTER USE)
// ==========================================
router.get('/nuke-database', async (req, res) => {
    try {
        const { Person, Patient, PractitionerRole, Prescription } = require('../models/GridModels');
        
        await Person.deleteMany({});
        await Patient.deleteMany({});
        await PractitionerRole.deleteMany({});
        await Prescription.deleteMany({});

        res.send(`
            <div style="font-family: monospace; background: #05080f; color: #00FF66; padding: 50px; text-align: center; height: 100vh;">
                <h1>=== PURGE COMPLETE ===</h1>
                <p>All legacy ghosts have been eradicated. The Grid is perfectly clean.</p>
                <p style="color: #FF003C; margin-top: 30px;">⚠️ CRITICAL: Remove this code from routes/auth.js and push to Vercel immediately!</p>
            </div>
        `);
    } catch (err) {
        res.status(500).send("Purge Failed: " + err.message);
    }
});

module.exports = router;