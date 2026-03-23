const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');

router.post('/add', async (req, res) => {
    // DEBUG: This will show us if the body is actually reaching the server
    console.log("📥 Incoming Data Payload:", req.body);

    try {
        const { patientId, medications, diagnosis, notes, doctorName } = req.body;

        // 1. Check if patientId was actually sent
        if (!patientId) {
            return res.status(400).json({ success: false, error: "Patient ID is missing from the request." });
        }

        // 2. Verify Patient in Vault
        const patientExists = await Patient.findById(patientId);
        if (!patientExists) {
            return res.status(404).json({ success: false, error: "No patient found with that ID." });
        }

        // 3. Create Prescription (Defaulting to Toki Tahmid if name is missing)
        const newPrescription = new Prescription({
            patient: patientId,
            medications,
            diagnosis,
            notes,
            doctorName: doctorName || "Toki Tahmid" 
        });

        const savedPrescription = await newPrescription.save();
        res.status(201).json({ success: true, message: "Prescription issued!", data: savedPrescription });
        
    } catch (error) {
        console.error("❌ Prescription Error:", error);
        res.status(400).json({ success: false, error: error.message });
    }
});

module.exports = router;