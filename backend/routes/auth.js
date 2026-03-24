const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Import our newly forged modular schemas!
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Pharmacist = require('../models/Pharmacist');

const JWT_SECRET = process.env.JWT_SECRET || "HolmesIronVaultSecretKey2026"; 

// --- 🛡️ THE GATEWAY: REGISTRATION ---
router.post('/register', async (req, res) => {
    const { role, email, password, name, ...otherData } = req.body;
    
    if (!role || !email || !password || !name) {
        return res.status(400).json({ success: false, error: "Missing required fields." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        let newUser;

        // Route to the correct department based on role
        if (role === 'patient') {
            const patientId = "PT-" + Math.floor(10000 + Math.random() * 90000);
            newUser = new Patient({ patientId, email, password: hashedPassword, name, ...otherData });
        } else if (role === 'doctor') {
            const doctorId = "DR-" + Math.floor(1000 + Math.random() * 9000);
            newUser = new Doctor({ doctorId, email, password: hashedPassword, name, ...otherData });
        } else if (role === 'pharmacist') {
            const pharmacistId = "PH-" + Math.floor(1000 + Math.random() * 9000);
            newUser = new Pharmacist({ pharmacistId, email, password: hashedPassword, name, ...otherData });
        } else {
            return res.status(400).json({ success: false, error: "Invalid role specified." });
        }

        await newUser.save();
        res.status(201).json({ success: true, message: `${role} registered successfully!` });
        
    } catch (error) { 
        console.error("Registration Error:", error);
        // Specifically catch duplicate email errors (MongoDB error code 11000)
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: "Email is already registered." });
        }
        res.status(500).json({ success: false, error: "Registration failed. Please contact support." }); 
    }
});

// --- 🔐 THE GATEWAY: LOGIN ---
router.post('/login', async (req, res) => {
    const { role, email, password } = req.body;
    
    if (!role || !email || !password) {
        return res.status(400).json({ success: false, error: "Missing login credentials." });
    }

    try {
        let user;
        if (role === 'patient') user = await Patient.findOne({ email });
        else if (role === 'doctor') user = await Doctor.findOne({ email });
        else if (role === 'pharmacist') user = await Pharmacist.findOne({ email });

        if (!user) return res.status(404).json({ success: false, error: "User not found." });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ success: false, error: "Incorrect password." });

        // Forge the digital ID badge
        const token = jwt.sign(
            { id: user._id, role: role, email: user.email }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        // Strip the password before sending user data back to the frontend
        const userObj = user.toObject(); 
        delete userObj.password;

        res.status(200).json({ success: true, message: "Login successful", token, userData: userObj });
        
    } catch (error) { 
        console.error("Login Error:", error);
        res.status(500).json({ success: false, error: "Internal server error." }); 
    }
});

module.exports = router;