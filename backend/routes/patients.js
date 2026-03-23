const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient'); // Our previously drafted blueprint

// POST Endpoint: Register a new patient into the system
router.post('/add', async (req, res) => {
    try {
        // 1. Intercept the incoming data payload
        const { name, age, gender, contactNumber, medicalHistory } = req.body;

        // 2. Instantiate a new patient record, adhering strictly to the Schema
        const newPatient = new Patient({
            name,
            age,
            gender,
            contactNumber,
            medicalHistory
        });

        // 3. Securely commit the record to the MongoDB Vault
        const savedPatient = await newPatient.save();

        // 4. Return a successful 201 (Created) response with the assigned ID
        res.status(201).json({ 
            success: true,
            message: "Patient successfully registered in the central database.", 
            data: savedPatient 
        });

    } catch (error) {
        console.error("❌ Intake Valve Error:", error);
        
        // Return a professional 400 (Bad Request) if validation fails
        res.status(400).json({ 
            success: false,
            error: "Failed to process patient intake. Please verify the data format." 
        });
    }
});

module.exports = router;