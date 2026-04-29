const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Prescription, PractitionerRole, Patient } = require('../models/GridModels');

const ENCRYPTION_KEY = process.env.AES_KEY || 'holmes_master_key_32_bytes_long!';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: 'Grid Access Denied.' });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) {
        res.status(400).json({ msg: 'Invalid Identity Token.' });
    }
};

const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ msg: `Clearance Denied. Access restricted to: ${allowedRoles.join(' or ').toUpperCase()}.` });
        }
        next();
    };
};

const decrypt = (text) => {
    if (typeof text !== 'string') return text;
    try {
        const [ivHex, encrypted] = text.split(':');
        if (!ivHex || !encrypted) return text;
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        return text;
    }
};

const decryptMedicationObject = (item) => {
    if (!item || typeof item !== 'object') return item;
    return {
        brandName: typeof item.brandName === 'string' ? decrypt(item.brandName) : item.brandName,
        dosage: typeof item.dosage === 'string' ? decrypt(item.dosage) : item.dosage,
        timing: typeof item.timing === 'string' ? decrypt(item.timing) : item.timing,
        duration: typeof item.duration === 'string' ? decrypt(item.duration) : item.duration
    };
};

router.get('/claims', verifyToken, requireRole('insurance'), async (req, res) => {
    try {
        const adjuster = await PractitionerRole.findOne({ personId: req.user.id, roleType: 'Insurance' });
        if (!adjuster) return res.status(403).json({ msg: 'Insurance access blocked. Adjuster profile not found.' });

        const claims = await Prescription.find({
            $or: [
                { insuranceStatus: { $exists: false } },
                { insuranceStatus: { $in: ['Pending', 'Approved', 'Rejected'] } }
            ]
        })
        .sort({ createdAt: -1 })
        .populate({ path: 'patientId', populate: { path: 'personId', select: 'legalFullName gridId' } })
        .populate({ path: 'practitionerId', populate: { path: 'personId', select: 'legalFullName' } });

        const formatted = claims.map(rx => ({
            id: rx._id,
            broadcastId: rx.broadcastId,
            otp: rx.otp,
            status: rx.status,
            insuranceStatus: rx.insuranceStatus || 'Pending',
            createdAt: rx.createdAt,
            patientName: rx.patientId?.personId?.legalFullName || 'Unknown Citizen',
            patientGridId: rx.patientId?.personId?.gridId || 'UNKNOWN',
            doctorName: rx.practitionerId?.personId?.legalFullName || 'Unknown Doctor',
            medications: Array.isArray(rx.medications) ? rx.medications.map(decryptMedicationObject) : rx.medications,
            investigations: rx.investigations || []
        }));

        res.json(formatted);
    } catch (err) {
        console.error('INSURANCE_CLAIMS_FETCH_ERR:', err);
        res.status(500).json({ msg: 'Failure retrieving claim ledger.' });
    }
});

router.put('/claims/:id/approve', verifyToken, requireRole('insurance'), async (req, res) => {
    try {
        const claim = await Prescription.findById(req.params.id);
        if (!claim) return res.status(404).json({ msg: 'Claim not found.' });

        claim.insuranceStatus = 'Approved';
        await claim.save();

        res.json({ msg: 'Claim approved and flagged for payout reconciliation.' });
    } catch (err) {
        console.error('CLAIM_APPROVAL_ERR:', err);
        res.status(500).json({ msg: 'Failure processing claim approval.' });
    }
});

router.put('/claims/:id/reject', verifyToken, requireRole('insurance'), async (req, res) => {
    try {
        const claim = await Prescription.findById(req.params.id);
        if (!claim) return res.status(404).json({ msg: 'Claim not found.' });

        claim.insuranceStatus = 'Rejected';
        await claim.save();

        res.json({ msg: 'Claim rejected and returned to clinical workflow.' });
    } catch (err) {
        console.error('CLAIM_REJECTION_ERR:', err);
        res.status(500).json({ msg: 'Failure processing claim rejection.' });
    }
});

module.exports = router;
