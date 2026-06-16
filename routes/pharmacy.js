const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const { authenticate } = require('../middleware/auth');

/**
 * 🔓 DECRYPT PAYLOAD (Grid Broadcast ID + Patient OTP)
 * Logic: Pharmacist inputs the codes. If they match, the Grid yields the Rx details.
 */
router.post('/decrypt', authenticate, pharmacyController.decryptPayload);

/**
 * ✅ MARK AS DISPENSED (Sever the Chain of Custody)
 * Logic: Once handed over, the Rx is locked so it cannot be reused.
 */
router.post('/dispense/:rxId', authenticate, pharmacyController.dispensePrescription);

module.exports = router;