const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Person, Patient, PractitionerRole } = require('../models/GridModels');

// ==========================================
// 1. REGISTER NEW GRID IDENTITY (With Auto-ID)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        let person = await Person.findOne({ loginIdentity: email });
        if (person) return res.status(400).json({ msg: 'Identity already exists in the Grid.' });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 1. AUTO-GENERATE GRID ID BASED ON ROLE
        let idPrefix = 'ADM';
        if (role === 'patient') idPrefix = 'CIT';
        else if (role === 'doctor') idPrefix = 'DOC';
        else if (role === 'pharmacist') idPrefix = 'PHM';
        else if (role === 'pathologist') idPrefix = 'PTH';
        
        const generatedGridId = `${idPrefix}-${Math.floor(1000000 + Math.random() * 9000000).toString()}`;

        // 2. Create Core Person Document
        person = new Person({
            gridId: generatedGridId,
            loginIdentity: email,
            passwordHash: passwordHash, 
            legalFullName: name,
            contact: { primaryEmail: email, primaryMobile: '0000000000' }
        });
        await person.save();

        // 3. Create Role-Specific Profile
        if (role === 'patient') {
            const nhi = 'NHI-' + Math.floor(1000000000 + Math.random() * 9000000000).toString();
            const placeholderNid = 'NID-PENDING-' + Date.now().toString(); 
            const patient = new Patient({ personId: person._id, nationalHealthId: nhi, nationalId: placeholderNid });
            await patient.save();
        } else {
            const roleMapping = { 'doctor': 'Doctor', 'pharmacist': 'Pharmacist', 'pathologist': 'Pathologist', 'admin': 'Admin' };
            const pracRole = new PractitionerRole({ personId: person._id, roleType: roleMapping[role] || 'Doctor' });
            await pracRole.save();
        }

        res.status(201).json({ msg: 'Identity Initialized.' });
    } catch (err) {
        console.error("REGISTER_ERR:", err);
        res.status(500).json({ msg: 'Grid Error: ' + err.message });
    }
});

// ==========================================
// 2. AUTHENTICATE & LOGIN (Self-Healing ID)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;

        const person = await Person.findOne({ loginIdentity: email });
        if (!person) return res.status(400).json({ msg: 'Invalid Credentials.' });

        const isMatch = await bcrypt.compare(password, person.passwordHash);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials.' });

        if (role === 'patient') {
            const pat = await Patient.findOne({ personId: person._id });
            if (!pat) return res.status(403).json({ msg: 'Identity is not registered as a Citizen.' });
        } else {
            const roleMapping = { 'doctor': 'Doctor', 'pharmacist': 'Pharmacist', 'pathologist': 'Pathologist', 'admin': 'Admin' };
            const prac = await PractitionerRole.findOne({ personId: person._id, roleType: roleMapping[role] });
            if (!prac) return res.status(403).json({ msg: `Identity is not registered as a ${roleMapping[role]}.` });
        }

        // 🚨 THE SELF-HEALING FAIL-SAFE: Generate ID if missing!
        if (!person.gridId || person.gridId === 'null') {
            let idPrefix = 'ADM';
            if (role === 'patient') idPrefix = 'CIT';
            else if (role === 'doctor') idPrefix = 'DOC';
            else if (role === 'pharmacist') idPrefix = 'PHM';
            else if (role === 'pathologist') idPrefix = 'PTH';
            
            person.gridId = `${idPrefix}-${Math.floor(1000000 + Math.random() * 9000000).toString()}`;
            await person.save(); // Save the new ID permanently to MongoDB
        }

        const payload = {
            id: person._id,
            name: person.legalFullName,
            role: role,
            uuid: person.gridId // Send the guaranteed ID to the frontend
        };

        jwt.sign(payload, process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026', { expiresIn: '12h' }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: payload });
        });
    } catch (err) {
        console.error("LOGIN_ERR:", err);
        res.status(500).json({ msg: 'Grid Server Error during login.' });
    }
});


// ==========================================
// ☢️ TEMPORARY RETROACTIVE SYNC TOOL
// ==========================================
router.get('/sync-ids', async (req, res) => {
    try {
        const persons = await Person.find({});
        let syncedCount = 0;

        for (let person of persons) {
            if (!person.gridId || person.gridId === null) {
                let idPrefix = 'ADM';
                const isPat = await Patient.findOne({ personId: person._id });
                if (isPat) { idPrefix = 'CIT'; } 
                else {
                    const prac = await PractitionerRole.findOne({ personId: person._id });
                    if (prac) {
                        if (prac.roleType === 'Doctor') idPrefix = 'DOC';
                        else if (prac.roleType === 'Pharmacist') idPrefix = 'PHM';
                        else if (prac.roleType === 'Pathologist') idPrefix = 'PTH';
                    }
                }

                person.gridId = `${idPrefix}-${Math.floor(1000000 + Math.random() * 9000000).toString()}`;
                await person.save();
                syncedCount++;
            }
        }
        res.send(`<div style="font-family: monospace; background: #05080f; color: #00FF66; padding: 50px; text-align: center; height: 100vh;">
            <h1>=== SYSTEM SYNC COMPLETE ===</h1>
            <p>${syncedCount} legacy profiles successfully assigned Grid IDs.</p>
        </div>`);
    } catch (err) { res.status(500).send("Sync Failed: " + err.message); }
});

module.exports = router;