const express = require('express');
const router = express.Router();
const clinicalController = require('../controllers/clinicalController');
const { verifyToken } = require('../middleware/auth');

// ==========================================
// 1. FETCH MASTER FORMULARY (Substance Intelligence Engine)
// ==========================================
router.get('/formulary', verifyToken, clinicalController.getFormulary);

// ==========================================
// 2. MPI SEARCH ENGINE (Find Patient)
// ==========================================
router.post('/search', verifyToken, clinicalController.searchPatients);

// ==========================================
// 3. CLINICAL DOSSIER (Fetch Allergies + Active Medications)
// ==========================================
router.get('/dossier/:id', verifyToken, clinicalController.getPatientDossier);

module.exports = router;