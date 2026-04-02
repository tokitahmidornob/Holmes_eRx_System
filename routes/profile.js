const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User, Person, Patient, PractitionerRole } = require('../models/GridModels');

// Cryptographic Token Verification
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: "Grid Access Denied." });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) {
        res.status(400).json({ msg: "Invalid Identity Token." });
    }
};

// ==========================================
// 📥 GET: FETCH CURRENT IDENTITY
// ==========================================
router.get('/', verifyToken, async (req, res) => {
    try {
        const person = await Person.findById(req.user.id);
        let roleData = null;

        if (req.user.role === 'patient') {
            roleData = await Patient.findOne({ personId: req.user.id });
        } else {
            roleData = await PractitionerRole.findOne({ personId: req.user.id });
        }

        res.json({ person, roleData, role: req.user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Grid Error: Cannot fetch Identity Matrix." });
    }
});

// ==========================================
// 🔐 PUT: UPDATE FULL IDENTITY MATRIX
// ==========================================
router.put('/update', verifyToken, async (req, res) => {
    try {
        const {
            legalFullName,
            dateOfBirth,
            gender,
            healthId,
            mobile,
            email,
            address,
            languagePref,
            bloodGroup,
            emergencyContact,
            guardian,
            insurance
        } = req.body;

        const person = await Person.findById(req.user.id);
        if (!person) return res.status(404).json({ msg: "Person record not found." });

        person.contact = person.contact || {};
        let personModified = false;

        if (typeof legalFullName === 'string' && legalFullName.trim() !== '') {
            person.legalFullName = legalFullName.trim();
            personModified = true;
        }
        if (typeof dateOfBirth === 'string' && dateOfBirth.trim() !== '') {
            const parsedDob = new Date(dateOfBirth);
            if (!isNaN(parsedDob)) {
                person.dateOfBirth = parsedDob;
                personModified = true;
            }
        }
        if (typeof gender === 'string' && gender.trim() !== '') {
            person.genderLegal = gender.trim();
            personModified = true;
        }
        if (typeof healthId === 'string' && healthId.trim() !== '') {
            person.gridId = healthId.trim();
            personModified = true;
        }
        if (typeof email === 'string' && email.trim() !== '') {
            person.contact.primaryEmail = email.trim();
            personModified = true;
        }
        if (typeof mobile === 'string' && mobile.trim() !== '') {
            person.contact.primaryMobile = mobile.trim();
            personModified = true;
        }
        if (typeof address === 'string' && address.trim() !== '') {
            person.contact.address = address.trim();
            personModified = true;
        }
        if (typeof languagePref === 'string' && languagePref.trim() !== '') {
            person.contact.languagePref = languagePref.trim();
            personModified = true;
        }

        const patient = await Patient.findOne({ personId: req.user.id });
        let patientModified = false;
        if (patient) {
            if (typeof bloodGroup === 'string' && bloodGroup.trim() !== '') {
                patient.bloodGroup = bloodGroup.trim();
                patientModified = true;
            }
            if (typeof emergencyContact === 'string' && emergencyContact.trim() !== '') {
                patient.emergencyContact = emergencyContact.trim();
                patientModified = true;
            }
            if (typeof guardian === 'string' && guardian.trim() !== '') {
                patient.guardian = guardian.trim();
                patientModified = true;
            }
            if (typeof insurance === 'string' && insurance.trim() !== '') {
                patient.insuranceProvider = insurance.trim();
                patientModified = true;
            }
        }

        const practitioner = !patient ? await PractitionerRole.findOne({ personId: req.user.id }) : null;
        let practitionerModified = false;
        if (practitioner) {
            // Reserved for future expanded experience fields.
            practitionerModified = false;
        }

        if (!personModified && !patientModified && !practitionerModified) {
            return res.status(400).json({ msg: "No identity fields were provided for update." });
        }

        if (personModified) {
            person.markModified('contact');
            await person.save();
        }
        if (patientModified) await patient.save();
        if (practitioner && practitionerModified) await practitioner.save();

        res.json({ msg: "Identity Matrix updated successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Grid Error: Failed to update Identity Matrix." });
    }
});

// ==========================================
// � GET: PROFILE MATRIX AGGREGATOR
// ==========================================
router.get('/matrix', verifyToken, async (req, res) => {
    try {
        const security = await User.findById(req.user.id).select('-passwordHash -__v');
        if (!security) return res.status(404).json({ msg: 'Security profile not found.' });

        const coreIdentity = await Person.findById(req.user.id).select('-passwordHash -__v');
        if (!coreIdentity) return res.status(404).json({ msg: 'Core identity not found.' });

        const matrix = {
            layer5: {
                accountId: req.user.id,
                role: req.user.role,
                security: security
            },
            layer1: {
                personId: coreIdentity._id,
                legalFullName: coreIdentity.legalFullName,
                gridId: coreIdentity.gridId,
                contact: coreIdentity.contact,
                dateOfBirth: coreIdentity.dateOfBirth,
                genderLegal: coreIdentity.genderLegal
            },
            layer2: null,
            layer3: null,
            layer4: null
        };

        if (req.user.role === 'patient') {
            const patientProfile = await Patient.findOne({ personId: req.user.id }).select('-__v');
            matrix.layer4 = patientProfile;
            matrix.patientProfile = patientProfile;
        } else {
            const practitionerProfiles = await PractitionerRole.find({ personId: req.user.id }).select('-__v');
            matrix.layer2 = practitionerProfiles;
            matrix.practitionerRoles = practitionerProfiles;
        }

        res.json(matrix);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Grid Error: Cannot construct the Identity Matrix.' });
    }
});

// ==========================================
// �📤 PUT: UPDATE ELABORATED PROFILE
// ==========================================
router.put('/', verifyToken, async (req, res) => {
    try {
        const { mobile, dob, gender, bloodGroup, nationalId, licenseNumber, specialty } = req.body;

        // 1. Update Core Person Details (Shared by everyone)
        await Person.findByIdAndUpdate(req.user.id, {
            'contact.primaryMobile': mobile,
            dateOfBirth: dob ? new Date(dob) : null,
            genderLegal: gender
        });

        // 2. Update Role-Specific Details
        if (req.user.role === 'patient') {
            await Patient.findOneAndUpdate({ personId: req.user.id }, {
                bloodGroup: bloodGroup,
                nationalId: nationalId
            });
        } else {
            await PractitionerRole.findOneAndUpdate({ personId: req.user.id }, {
                licenseNumber: licenseNumber,
                specialty: specialty ? specialty.split(',').map(s => s.trim()) : []
            });
        }

        res.json({ msg: "Identity Matrix Successfully Updated and Sealed." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Grid Error: Failed to update Identity Matrix." });
    }
});

module.exports = router;