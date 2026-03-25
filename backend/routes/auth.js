const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Import your Models
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Pharmacist = require('../models/Pharmacist');

// --- 📝 REGISTRATION ROUTE ---
router.post('/register', async (req, res) => {
    try {
        const { role, name, email, password } = req.body;
        
        if (!role || !name || !email || !password) {
            return res.status(400).json({ success: false, error: "Missing required fields." });
        }

        let newUser;
        const userId = 'USR-' + Date.now(); // Simple Unique ID

        if (role === 'doctor') {
            newUser = new Doctor({ doctorId: userId, name, email, password });
        } else if (role === 'patient') {
            newUser = new Patient({ patientId: userId, name, email, password });
        } else if (role === 'pharmacist') {
            newUser = new Pharmacist({ pharmacistId: userId, name, email, password });
        }

        await newUser.save();
        res.status(201).json({ success: true, message: "User registered successfully!" });
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- 🔐 LOGIN ROUTE (SUPER-DEBUG VERSION) ---
router.post('/login', async (req, res) => {
    try {
        const { role, email, password } = req.body;
        console.log(`\n--- 🕵️‍♂️ Login Attempt Detected ---`);
        console.log(`Role: ${role} | Email: ${email}`);

        let user;
        // 1. Determine which cabinet to look in
        if (role === 'doctor') {
            user = await Doctor.findOne({ email: email });
        } else if (role === 'patient') {
            user = await Patient.findOne({ email: email });
        } else if (role === 'pharmacist') {
            user = await Pharmacist.findOne({ email: email });
        }

        // 2. Check if user exists
        if (!user) {
            console.log("❌ Result: No user found in the database with that email/role combination.");
            return res.status(401).json({ success: false, error: "Authentication failed. User not found." });
        }

        // 3. Compare Passwords (Temporary plain-text check for development)
        console.log(`🔍 Comparing Passwords...`);
        console.log(`Input Password: [${password}] | DB Password: [${user.password}]`);

        if (user.password !== password) {
            console.log("❌ Result: Password mismatch.");
            return res.status(401).json({ success: false, error: "Authentication failed. Incorrect password." });
        }

        // 4. Success! Generate Badge (Token)
        console.log("✅ Result: Success! Generating secure token...");
        const token = jwt.sign(
            { id: user._id, role: role },
            process.env.JWT_SECRET || 'HOLMES_SECRET_KEY',
            { expiresIn: '1d' }
        );

        // Replace the res.status(200) block with this:
    res.status(200).json({
    success: true,
    token: token,
    userData: { 
        id: user._id, // 👈 ADD THIS LINE
        name: user.name, 
        role: role, 
        email: user.email 
    }
});

    } catch (error) {
        console.error("🔥 Server Login Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
});

module.exports = router;