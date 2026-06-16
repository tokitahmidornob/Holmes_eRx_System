const express = require('express');
const router = express.Router();
const rxController = require('../controllers/rxController');
const { verifyToken, requireRole } = require('../middleware/auth');

// ==========================================
// 1. DOCTOR: SEAL & BROADCAST PAYLOAD
// ==========================================
router.post('/', verifyToken, requireRole('doctor'), rxController.createPrescription);

// ==========================================
// 2. DOCTOR: FETCH MASTER ARCHIVE
// ==========================================
router.get('/doctor/me', verifyToken, requireRole('doctor'), rxController.getDoctorHistory);

// ==========================================
// 3. PATIENT: VIEW PERSONAL HEALTH VAULT
// ==========================================
router.get('/patient/me', verifyToken, requireRole('patient'), rxController.getPatientVault);

// ==========================================
// 4. MULTI-AUTHORITY: DECRYPT PAYLOAD
// ==========================================
router.post('/decrypt', verifyToken, requireRole('pharmacist', 'pathologist'), rxController.decryptPayload);

// ==========================================
// 5. PHARMACIST: DISPENSE PAYLOAD
// ==========================================
router.put('/dispense/:id', verifyToken, requireRole('pharmacist'), rxController.dispensePayload);

module.exports = router;