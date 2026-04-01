const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Prescription, PractitionerRole, Patient } = require('../models/GridModels');

// ============================================================================
// 🛡️ SECURITY: JWT IDENTITY VERIFICATION
// ============================================================================
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: "Grid Access Denied." });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) { res.status(400).json({ msg: "Invalid Identity Token." }); }
};

// ============================================================================
// 🛡️ SECURITY: ENTERPRISE RBAC CLEARANCE
// ============================================================================
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                msg: `Clearance Denied. Access restricted to: ${allowedRoles.join(' or ').toUpperCase()}.` 
            });
        }
        next();
    };
};

const ENCRYPTION_KEY = process.env.AES_KEY || 'holmes_master_key_32_bytes_long!';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const encrypt = (text) => {
    if (typeof text !== 'string') return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
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

const createEmailTransporter = async () => {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    const testAccount = await nodemailer.createTestAccount();
    console.log('Ethereal test account ready:', testAccount.user);
    return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        }
    });
};

const sendPrescriptionNotification = async ({ patientEmail, patientName, doctorName, broadcastId, otp }) => {
    if (!patientEmail) {
        console.warn('Patient email not found. Skipping broadcast email.');
        return;
    }

    const transporter = await createEmailTransporter();
    const mailOptions = {
        from: `"Holmes eRx Grid" <${process.env.SMTP_USER || 'no-reply@holmeserx.test'}>`,
        to: patientEmail,
        subject: 'Holmes eRx Broadcast ID and OTP',
        html: `
            <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.7;padding:24px;">
                <h2 style="margin-bottom:12px;color:#0f172a;">Citizen Broadcast Confirmation</h2>
                <p>Hello <strong>${patientName}</strong>,</p>
                <p>Your prescription has been securely sealed by <strong>Dr. ${doctorName}</strong>.</p>
                <div style="margin:20px 0;padding:18px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:18px;">
                    <p style="margin:0 0 8px;font-size:0.95rem;"><strong>Broadcast ID:</strong> <span style="color:#0f172a;">${broadcastId}</span></p>
                    <p style="margin:0;font-size:0.95rem;"><strong>One-Time PIN:</strong> <span style="color:#0f172a;">${otp}</span></p>
                </div>
                <p>Please keep this information confidential and present it only to the authorized dispensary when collecting your medication.</p>
                <p style="margin-top:24px;font-size:0.92rem;color:#475569;">Thank you for using the Holmes National Health Grid.</p>
            </div>
        `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Secure payload dispatched to Citizen. MessageId:', info.messageId);
    if (nodemailer.getTestMessageUrl) {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
};

// ==========================================
// 1. DOCTOR: SEAL & BROADCAST PAYLOAD
// ==========================================
router.post('/', verifyToken, requireRole('doctor'), async (req, res) => {
    try {
        const { patientId, medications, investigations } = req.body;
        if (!patientId || !medications || medications.length === 0) {
            return res.status(400).json({ msg: "Invalid Payload. Patient and Therapy required." });
        }

        const practitioner = await PractitionerRole.findOne({ personId: req.user.id })
            .populate({ path: 'personId', select: 'legalFullName' });
        if (!practitioner) return res.status(404).json({ msg: "Practitioner authority not found." });

        const patient = await Patient.findById(patientId)
            .populate({ path: 'personId', select: 'legalFullName contact.primaryEmail' });

        const broadcastId = 'RX-' + crypto.randomBytes(2).toString('hex').toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const encryptedMedications = medications.map((med) => {
            if (typeof med === 'string') {
                return encrypt(med);
            }
            return {
                brandName: typeof med.brandName === 'string' ? encrypt(med.brandName) : med.brandName,
                dosage: typeof med.dosage === 'string' ? encrypt(med.dosage) : med.dosage,
                timing: typeof med.timing === 'string' ? encrypt(med.timing) : med.timing,
                duration: typeof med.duration === 'string' ? encrypt(med.duration) : med.duration
            };
        });

        const newRx = new Prescription({
            patientId: patientId,
            practitionerId: practitioner._id,
            medications: encryptedMedications,
            investigations: investigations || [],
            broadcastId: broadcastId,
            otp: otp,
            status: 'Active'
        });

        await newRx.save();

        res.status(201).json({ 
            msg: "Payload Sealed Successfully.", 
            broadcastId: broadcastId,
            otp: otp 
        });

        sendPrescriptionNotification({
            patientEmail: patient?.personId?.contact?.primaryEmail,
            patientName: patient?.personId?.legalFullName || 'Citizen',
            doctorName: practitioner?.personId?.legalFullName || 'Healthcare Provider',
            broadcastId,
            otp
        }).catch(err => console.error('EMAIL_NOTIFICATION_ERR:', err));

    } catch (err) {
        console.error("PRESCRIPTION_SEAL_ERR:", err);
        res.status(500).json({ msg: "Grid Failure during Payload Encryption." });
    }
});

// ==========================================
// 2. DOCTOR: FETCH MASTER ARCHIVE
// ==========================================
router.get('/doctor/me', verifyToken, requireRole('doctor'), async (req, res) => {
    try {
        const practitioner = await PractitionerRole.findOne({ personId: req.user.id });
        if (!practitioner) return res.status(404).json({ msg: "Practitioner authority not found." });

        const history = await Prescription.find({ practitionerId: practitioner._id })
            .sort({ createdAt: -1 })
            .populate({
                path: 'patientId',
                populate: { path: 'personId', select: 'legalFullName gridId' }
            });

        const formattedHistory = history.map(rx => ({
            broadcastId: rx.broadcastId,
            otp: rx.otp,
            status: rx.status,
            createdAt: rx.createdAt,
            medications: Array.isArray(rx.medications) ? rx.medications.map(decryptMedicationObject) : rx.medications,
            investigations: rx.investigations,
            patientId: rx.patientId && rx.patientId.personId ? rx.patientId.personId.legalFullName : 'Unknown Citizen'
        }));

        res.json(formattedHistory);
    } catch (err) {
        console.error("ARCHIVE_SYNC_ERR:", err);
        res.status(500).json({ msg: "Grid Failure during Archive Sync." });
    }
});

// ==========================================
// 3. PATIENT: VIEW PERSONAL HEALTH VAULT
// ==========================================
router.get('/patient/me', verifyToken, requireRole('patient'), async (req, res) => {
    try {
        const patient = await Patient.findOne({ personId: req.user.id });
        if (!patient) return res.status(404).json({ msg: "Patient profile not found." });

        const records = await Prescription.find({ patientId: patient._id })
            .sort({ createdAt: -1 })
            .populate({ path: 'practitionerId', populate: { path: 'personId', select: 'legalFullName' } });

        const formattedRecords = records.map(rx => ({
            broadcastId: rx.broadcastId,
            otp: rx.otp,
            status: rx.status,
            createdAt: rx.createdAt,
            medications: Array.isArray(rx.medications) ? rx.medications.map(decryptMedicationObject) : rx.medications,
            investigations: rx.investigations,
            doctorName: rx.practitionerId && rx.practitionerId.personId ? rx.practitionerId.personId.legalFullName : 'Unknown Doctor'
        }));

        res.json(formattedRecords);
    } catch (err) {
        console.error("PATIENT_VAULT_ERR:", err);
        res.status(500).json({ msg: "Grid Failure while fetching health vault." });
    }
});

// ==========================================
// 4. MULTI-AUTHORITY: DECRYPT PAYLOAD
// ==========================================
// 🚨 Notice the RBAC allows BOTH pharmacist and pathologist here
router.post('/decrypt', verifyToken, requireRole('pharmacist', 'pathologist'), async (req, res) => {
    try {
        const { broadcastId, otp } = req.body;
        
        const rx = await Prescription.findOne({ broadcastId: broadcastId.trim(), otp: otp.trim() })
            .populate({ path: 'patientId', populate: { path: 'personId', select: 'legalFullName' } })
            .populate({ path: 'practitionerId', populate: { path: 'personId', select: 'legalFullName' } });

        if (!rx) return res.status(404).json({ msg: "Grid Error: Payload Not Found or Invalid Keys." });
        
        // Dynamic Payload Filtering based on Authority
        let filteredData = {
            msg: "Decryption Successful.", 
            rxId: rx._id,
            status: rx.status,
            patientName: rx.patientId.personId.legalFullName,
            doctorName: rx.practitionerId.personId.legalFullName,
            date: rx.createdAt
        };

        if (req.user.role === 'pharmacist') {
            filteredData.medications = Array.isArray(rx.medications) ? rx.medications.map(decryptMedicationObject) : rx.medications;
        } else if (req.user.role === 'pathologist') {
            filteredData.investigations = rx.investigations;
        }

        res.json(filteredData);

    } catch (err) {
        console.error("DECRYPT_ERR:", err);
        res.status(500).json({ msg: "Grid Failure during decryption." });
    }
});

// ==========================================
// 4. PHARMACIST: DISPENSE PAYLOAD
// ==========================================
router.put('/dispense/:id', verifyToken, requireRole('pharmacist'), async (req, res) => {
    try {
        const rx = await Prescription.findById(req.params.id);
        if (!rx) return res.status(404).json({ msg: "Payload not found." });
        
        if (rx.status === 'Dispensed') return res.status(400).json({ msg: "CRITICAL: This payload has already been dispensed! Fraud detected." });

        rx.status = 'Dispensed'; 
        await rx.save();
        
        res.json({ msg: "Payload Dispensed and cryptographically locked in the Grid." });
    } catch (err) {
        res.status(500).json({ msg: "Grid Failure during dispensing." });
    }
});

module.exports = router;