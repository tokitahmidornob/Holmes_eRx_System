const express = require('express');
const router = express.Router();
const labController = require('../controllers/labController');
const { authenticate } = require('../middleware/auth');

// ==========================================
// 🔬 PATHOLOGIST: UPLOAD NEW LAB REPORT
// ==========================================
router.post('/', authenticate, labController.uploadLabReport);

// ==========================================
// 🩺 DOCTOR/PATIENT: FETCH LABS FOR A SPECIFIC RX
// ==========================================
router.get('/prescription/:rxId', authenticate, labController.getLabsForPrescription);

// ==========================================
// 🧠 AI DIAGNOSTIC SUMMARIZATION
// ==========================================
router.post('/generate-summary', authenticate, labController.generateAISummary);

module.exports = router;