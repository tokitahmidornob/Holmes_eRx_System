const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// 📧 THE DISPATCH ENGINE (Nodemailer Setup)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 🛡️ THE SECURITY TRIPWIRE (In-Memory Brute Force Tracker)
const securityLog = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutes

const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied.' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Contains Dr's name, email, role, etc.
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Invalid Token.' });
    }
};

// ==========================================
// 🩺 DOCTOR ROUTE 1: CREATE NEW PRESCRIPTION
// ==========================================
router.post('/', authenticate, async (req, res) => {
    try {
        const generatedBroadcastId = 'HOLMES-RX-' + Math.floor(1000 + Math.random() * 9000);
        const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();

        const newRx = new Prescription({
            ...req.body,
            broadcastId: generatedBroadcastId,
            otp: generatedOtp,
            status: 'Active'
        });
        const savedRx = await newRx.save();

        // 🚀 FIRE THE DISPATCH ENGINE 🚀
        try {
            const mailOptions = {
                from: `"Holmes Health Grid" <${process.env.EMAIL_USER}>`,
                to: req.body.patientId, // Patient's email from the frontend
                subject: '🔒 Secure Medical Prescription Broadcast',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                        <h2 style="color: #0f172a; text-transform: uppercase; margin-bottom: 5px;">Holmes eRx System</h2>
                        <p style="color: #64748b; font-size: 14px; margin-top: 0;">Official Grid Notification</p>
                        
                        <p style="color: #334155; line-height: 1.6;">A new electronic prescription has been securely broadcast to the National Grid for you by <strong>Dr. ${req.user.name}</strong>.</p>
                        
                        <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 25px 0; text-align: center;">
                            <p style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin: 0;">Prescription Rx No.</p>
                            <p style="font-size: 22px; font-weight: 900; font-family: monospace; color: #0f172a; margin: 5px 0 15px 0;">${generatedBroadcastId}</p>
                            
                            <div style="height: 1px; background: #e2e8f0; margin: 15px 0;"></div>
                            
                            <p style="font-size: 10px; font-weight: bold; color: #10b981; text-transform: uppercase; letter-spacing: 2px; margin: 0;">Secure OTP Key</p>
                            <p style="font-size: 36px; font-weight: 900; font-family: monospace; color: #059669; margin: 5px 0 0 0; letter-spacing: 8px;">${generatedOtp}</p>
                        </div>
                        
                        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">Please present these credentials to your authorized Pharmacist or Pathologist to unlock your medications and lab orders.</p>
                        
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;">
                        <p style="font-size: 10px; color: #94a3b8; text-align: center; text-transform: uppercase; font-weight: bold;">This is an automated encrypted transmission. Do not reply.</p>
                    </div>
                `
            };
            
            // Send the email asynchronously without crashing the server if it fails
            await transporter.sendMail(mailOptions);
            console.log("✉️ Dispatch Engine: Secure email transmitted to patient.");
        } catch (emailErr) {
            console.error("❌ Dispatch Engine Error:", emailErr.message);
            // We DO NOT throw an error here. The Rx is already saved to the database.
        }

        res.status(201).json(savedRx);
    } catch (err) {
        console.error("Create Rx Error:", err);
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 🩺 DOCTOR ROUTE 2: FETCH DOCTOR'S HISTORY
// ==========================================
router.get('/doctor/:id', authenticate, async (req, res) => {
    try {
        const rxs = await Prescription.find({ doctorId: req.params.id }).sort({ createdAt: -1 });
        res.json(rxs);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 👤 PATIENT ROUTE: FETCH PATIENT'S HISTORY
// ==========================================
router.get('/patient/:email', authenticate, async (req, res) => {
    try {
        const rxs = await Prescription.find({ patientId: req.params.email })
            .populate('doctorId', 'name email')
            .sort({ createdAt: -1 });
        res.json(rxs);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 💊 PHARMACIST ROUTE 1: VERIFY (WITH TRIPWIRE)
// ==========================================
router.get('/verify', authenticate, async (req, res) => {
    try {
        const { broadcastId, otp } = req.query;
        if (!broadcastId || !otp) return res.status(400).json({ msg: "Missing Broadcast ID or OTP." });

        const currentTime = Date.now();
        if (securityLog.has(broadcastId)) {
            const log = securityLog.get(broadcastId);
            if (log.lockUntil > currentTime) {
                const remainingMinutes = Math.ceil((log.lockUntil - currentTime) / 60000);
                return res.status(429).json({ msg: `SECURITY LOCKOUT: Vault locked for ${remainingMinutes} minutes.` });
            }
        }

        const rx = await Prescription.findOne({ broadcastId }).populate('doctorId', 'name email');
        if (!rx) return res.status(404).json({ msg: "Broadcast ID not found." });

        if (rx.otp !== otp) {
            let log = securityLog.get(broadcastId) || { attempts: 0, lockUntil: 0 };
            log.attempts += 1;

            if (log.attempts >= MAX_ATTEMPTS) {
                log.lockUntil = currentTime + LOCKOUT_TIME_MS;
                log.attempts = 0; 
                securityLog.set(broadcastId, log);
                return res.status(429).json({ msg: `TRIPWIRE TRIGGERED: Vault locked for 15 minutes.` });
            }

            securityLog.set(broadcastId, log);
            return res.status(401).json({ msg: `Invalid OTP. ${MAX_ATTEMPTS - log.attempts} attempts remaining.` });
        }

        securityLog.delete(broadcastId);

        let formattedRx = rx.toObject();
        if (typeof formattedRx.patientId === 'string') {
            formattedRx.patientId = { name: formattedRx.patientId }; 
        }

        res.json(formattedRx);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 💊 PHARMACIST ROUTE 2: DISPENSE & LOCK
// ==========================================
router.put('/:id/dispense', authenticate, async (req, res) => {
    try {
        const rx = await Prescription.findById(req.params.id);
        if (!rx) return res.status(404).json({ msg: "Prescription not found." });
        if (rx.status === 'Dispensed') return res.status(400).json({ msg: "Already dispensed." });

        rx.status = 'Dispensed';
        await rx.save();
        res.json({ msg: "Prescription locked and dispensed." });
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

module.exports = router;