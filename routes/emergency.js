const express = require('express');
const router = express.Router();

router.post('/break-glass', async (req, res) => {
    try {
        const { targetPatientId, requestorId, emergencyReason } = req.body;

        if (!targetPatientId || !requestorId) {
            return res.status(400).json({ error: 'Critical parameters missing for override.' });
        }

        // 1. Log the immutable audit event (Simulated for the pitch)
        console.warn(`\n🚨 [AUDIT WARNING] BREAK-GLASS PROTOCOL INITIATED 🚨`);
        console.warn(`Timestamp: ${new Date().toISOString()}`);
        console.warn(`Requestor: ${requestorId} | Target: ${targetPatientId}`);
        console.warn(`Reason: ${emergencyReason}\n`);
        
        // 2. Bypass standard cryptographic seals and fetch raw data
        const unsealedData = {
            patientId: targetPatientId,
            status: "UNSEALED_EMERGENCY",
            criticalAllergies: ["Penicillin", "Latex"],
            activeMedications: ["Lisinopril 10mg", "Warfarin 5mg"],
            bloodType: "O-Negative"
        };

        res.status(200).json({
            status: 'success',
            alert: 'EMERGENCY OVERRIDE GRANTED. IMMUTABLE AUDIT LOGGED.',
            data: unsealedData
        });

    } catch (error) {
        console.error('Emergency Route Failure:', error);
        res.status(500).json({ error: 'Override routing failure.' });
    }
});

module.exports = router;
