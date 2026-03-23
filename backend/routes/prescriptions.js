const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription'); // Links to your Blueprint
const Patient = require('../models/Patient');           // To verify the patient exists

// POST: Create a new prescription
router.post('/add', async (req, res) => {
    try {
        const { patientId, medications, diagnosis, notes, doctorName } = req.body;

        // 1. Verification: Check if the patient actually exists in our records
        const patientExists = await Patient.findById(patientId);
        if (!patientExists) {
            return res.status(404).json({ 
                success: false, 
                error: "Patient not found. Cannot issue prescription for a non-existent record." 
            });
        }

        // 2. Draft the Prescription
        const newPrescription = new Prescription({
            patient: patientId,
            medications,
            diagnosis,
            notes,
            doctorName
        });

        // 3. Save to the Local Vault
        const savedPrescription = await newPrescription.save();

        res.status(201).json({
            success: true,
            message: "Prescription successfully issued!",
            data: savedPrescription
        });
        
    } catch (error) {
        console.error("❌ Prescription Error:", error);
        res.status(400).json({ 
            success: false, 
            error: "Failed to issue prescription. Check data formatting." 
        });
    }
});

module.exports = router;