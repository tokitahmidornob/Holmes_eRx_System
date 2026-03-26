const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// 🌟 INJECTING THE MASTER ARCHITECTURE
const { Person, Patient, PractitionerRole, Credential } = require('../models/GridModels');

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
// 1. GET CURRENT PROFILE (Adapter: DB -> Frontend)
// ==========================================
router.get('/', authenticate, async (req, res) => {
    try {
        const person = await Person.findById(req.user.id);
        if (!person) return res.status(404).json({ msg: 'Identity not found in Grid.' });

        // Base Frontend Object
        let responseObj = {
            nationalId: person.nationalId,
            phone: person.contact?.primaryMobile,
            dateOfBirth: person.dateOfBirth,
            gender: person.genderLegal,
            profileCompletion: person.audit?.verificationStatus === 'Verified' ? 100 : (person.audit?.verificationStatus === 'Pending' ? 50 : 20)
        };

        // Fetch & Map Role-Specific Data
        if (req.user.role === 'patient') {
            const patient = await Patient.findOne({ personId: person._id });
            if (patient) {
                responseObj.patientProfile = {
                    bloodGroup: patient.safetyAnchors?.bloodGroup,
                    emergencyContact: patient.emergencyContact,
                    knownAllergies: patient.safetyAnchors?.knownAllergies,
                    chronicConditions: patient.safetyAnchors?.chronicConditions,
                    surgeryHistory: patient.safetyAnchors?.surgeryHistory
                };
            }
        } else if (req.user.role === 'doctor') {
            const prac = await PractitionerRole.findOne({ personId: person._id });
            const cred = await Credential.findOne({ personId: person._id, credentialType: 'Medical License' });
            
            if (prac) {
                responseObj.doctorProfile = {
                    primarySpecialty: prac.doctorScopes?.specialty,
                    primaryDegree: prac.doctorScopes?.subSpecialty, // Mapping for UI simplicity
                    primaryHospital: prac.organizationId // In a full build, this would populate the Org name
                };
            }
            if (cred) responseObj.doctorProfile.bmdcNumber = cred.licenseNumber;
        }

        res.json(responseObj);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ msg: 'Server Error' }); 
    }
});

// ==========================================
// 2. UPDATE PROFILE (Adapter: Frontend -> DB)
// ==========================================
router.put('/', authenticate, async (req, res) => {
    try {
        const person = await Person.findById(req.user.id);
        const data = req.body;
        let score = 20;

        // 1. Update Universal Identity (Person Vault)
        if (data.nationalId) person.nationalId = data.nationalId;
        if (data.phone) {
            person.contact = person.contact || {};
            person.contact.primaryMobile = data.phone;
        }
        if (data.dateOfBirth) person.dateOfBirth = data.dateOfBirth;
        if (data.gender) person.genderLegal = data.gender;

        if (person.nationalId && person.contact?.primaryMobile) score += 30;

        // 2. Update Role Vaults
        if (req.user.role === 'patient' && data.patientProfile) {
            let patient = await Patient.findOne({ personId: person._id });
            
            patient.emergencyContact = data.patientProfile.emergencyContact;
            patient.safetyAnchors = patient.safetyAnchors || {};
            patient.safetyAnchors.bloodGroup = data.patientProfile.bloodGroup;
            patient.safetyAnchors.knownAllergies = data.patientProfile.knownAllergies;
            patient.safetyAnchors.chronicConditions = data.patientProfile.chronicConditions;
            patient.safetyAnchors.surgeryHistory = data.patientProfile.surgeryHistory;
            
            await patient.save();
            if (patient.safetyAnchors.bloodGroup) score += 50;

        } else if (req.user.role === 'doctor' && data.doctorProfile) {
            let prac = await PractitionerRole.findOne({ personId: person._id });
            prac.doctorScopes = prac.doctorScopes || {};
            prac.doctorScopes.specialty = data.doctorProfile.primarySpecialty;
            prac.doctorScopes.subSpecialty = data.doctorProfile.primaryDegree;
            await prac.save();

            // Store BMDC as a formal Credential Document
            if (data.doctorProfile.bmdcNumber) {
                await Credential.findOneAndUpdate(
                    { personId: person._id, credentialType: 'Medical License' },
                    { licenseNumber: data.doctorProfile.bmdcNumber, issuingAuthority: 'BMDC' },
                    { upsert: true, new: true }
                );
                score += 50;
            }
        }

        // 3. Save Security Status
        person.audit = person.audit || {};
        person.audit.verificationStatus = score === 100 ? 'Verified' : 'Pending';
        await person.save();

        res.json({ msg: 'Vault Synchronized Successfully', profileCompletion: score });

    } catch (err) { 
        console.error("Profile Engine Update Error:", err);
        res.status(500).json({ msg: 'Server Error during synchronization.' }); 
    }
});

// ==========================================
// 3. DOCTOR PRIVILEGE: FETCH PATIENT FOR RED FLAG SNAPSHOT
// ==========================================
router.get('/patient/:email', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'doctor') return res.status(403).json({msg: 'Unauthorized Clinical Access.'});
        
        const person = await Person.findOne({ loginIdentity: req.params.email });
        if (!person) return res.status(404).json({msg: 'Citizen not found in Grid.'});
        
        const patient = await Patient.findOne({ personId: person._id });
        
        // Map back to the exact format the Doctor Pad UI expects
        res.json({
            name: person.legalFullName,
            patientProfile: {
                bloodGroup: patient?.safetyAnchors?.bloodGroup,
                knownAllergies: patient?.safetyAnchors?.knownAllergies,
                chronicConditions: patient?.safetyAnchors?.chronicConditions,
                surgeryHistory: patient?.safetyAnchors?.surgeryHistory
            }
        });

    } catch (err) { 
        console.error("Snapshot Fetch Error:", err);
        res.status(500).json({ msg: 'Server Error' }); 
    }
});

module.exports = router;