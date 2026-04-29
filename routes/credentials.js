const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Credential } = require('../models/GridModels');

// 🔒 SECURITY TRIPWIRE (Using sessionStorage logic)
const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied. Terminal Unlinked.' });
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        next();
    } catch (err) { res.status(401).json({ msg: 'Invalid Grid Token.' }); }
};

/**
 * 🎓 UPLOAD PROFESSIONAL CREDENTIAL
 * Logic: Doctors/Pharmacists upload their license details for verification.
 */
router.post('/upload', authenticate, async (req, res) => {
    try {
        const { type, licenseNo, authority, effectiveDate, expiryDate, docUrl } = req.body;

        // Step 1: Create the Credential Entry
        const newCredential = new Credential({
            personId: req.user.id,
            credentialType: type, // e.g. 'Medical_License'
            licenseNumber: licenseNo,
            issuingAuthority: authority,
            effectiveDate: effectiveDate,
            expiryDate: expiryDate,
            documentAttachmentUrl: docUrl,
            audit: { 
                verificationStatus: 'Pending',
                sourceOfTruth: 'Self_Submitted_Evidence'
            }
        });

        const savedCred = await newCredential.save();

        // Step 2: Create an Audit Event for High-Security Tracking
        // (Our logAudit middleware handles the rest, but we can add manual notes here)
        console.log(`CRED_LOG: ${req.user.name} submitted ${type} for verification.`);

        res.status(201).json({ 
            msg: 'Legal Credential Vaulted. Awaiting National Authority Verification.',
            credentialId: savedCred._id 
        });

    } catch (err) {
        console.error("CRED_VAULT_ERR:", err);
        res.status(500).json({ msg: 'Credential Synchronisation Failure.' });
    }
});

/**
 * 🔍 VIEW MY VAULTED CREDENTIALS
 */
router.get('/my-vault', authenticate, async (req, res) => {
    try {
        const credentials = await Credential.find({ personId: req.user.id });
        res.json(credentials);
    } catch (err) {
        res.status(500).json({ msg: 'Vault Unreachable.' });
    }
});

module.exports = router;