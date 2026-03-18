const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');

// THE FIX: Appointment is now securely wired into the database imports!
const { Prescription, Patient, Doctor, Pharmacist, Drug, Appointment } = require('../models/Schemas');

const JWT_SECRET = "HolmesIronVaultSecretKey2026";

// --- 📁 FILE UPLOAD CONFIG (MEDICAL ARCHIVE) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// ==========================================
// 🔐 1. AUTHENTICATION & REGISTRATION GATEWAY
// ==========================================
router.post('/auth/register', async (req, res) => {
    const { role, email, password, name, ...otherData } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        let newUser;

        if (role === 'patient') {
            newUser = new Patient({ patientId: "PT-" + Math.floor(10000 + Math.random() * 90000), email, password: hashedPassword, name, ...otherData });
        } else if (role === 'doctor') {
            newUser = new Doctor({ doctorId: "DR-" + Math.floor(1000 + Math.random() * 9000), email, password: hashedPassword, name, ...otherData });
        } else if (role === 'pharmacist') {
            newUser = new Pharmacist({ pharmacistId: "PH-" + Math.floor(1000 + Math.random() * 9000), email, password: hashedPassword, name, ...otherData });
        } else {
            return res.status(400).json({ error: "Invalid role specified." });
        }

        await newUser.save();
        res.status(201).json({ message: `${role} registered successfully! You may now log in.` });
    } catch (error) { 
        res.status(500).json({ error: "Registration failed. Email might already exist." }); 
    }
});

router.post('/auth/login', async (req, res) => {
    const { role, email, password } = req.body;
    try {
        let user;
        if (role === 'patient') user = await Patient.findOne({ email });
        else if (role === 'doctor') user = await Doctor.findOne({ email });
        else if (role === 'pharmacist') user = await Pharmacist.findOne({ email });

        if (!user) return res.status(404).json({ error: "User not found in the directory." });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ error: "Incorrect password." });

        const token = jwt.sign({ id: user._id, role: role, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        
        const userObj = user.toObject(); delete userObj.password;

        res.status(200).json({ message: "Login successful", token, userData: userObj });
    } catch (error) { res.status(500).json({ error: "Internal server error." }); }
});

// ==========================================
// 👨‍⚕️ 2. DOCTOR DIRECTORY & PRACTICE MANAGEMENT
// ==========================================
router.get('/doctors/:id', async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ doctorId: req.params.id });
        if (!doctor) return res.status(404).json({ error: "Doctor not found." });
        const docObj = doctor.toObject(); delete docObj.password;
        res.status(200).json(docObj);
    } catch (error) { res.status(500).json({ error: "Failed to fetch profile." }); }
});

router.put('/doctors/:id/profile', async (req, res) => {
    try {
        const { designation, department, degrees, specialties, experienceYears, visitingHours, roomNumber, biography } = req.body;
        const degreesArray = degrees ? degrees.split(',').map(d => d.trim()) : [];
        const specialtiesArray = specialties ? specialties.split(',').map(s => s.trim()) : [];

        const updatedDoctor = await Doctor.findOneAndUpdate(
            { doctorId: req.params.id },
            { designation, department, degrees: degreesArray, specialties: specialtiesArray, experienceYears, visitingHours, roomNumber, biography },
            { new: true }
        );
        res.status(200).json({ message: "Profile updated successfully!", doctor: updatedDoctor });
    } catch (error) { res.status(500).json({ error: "Failed to update profile." }); }
});

router.put('/doctors/:id/practice', async (req, res) => {
    try {
        const { chambers, surgeryLogs } = req.body;
        const updatedDoctor = await Doctor.findOneAndUpdate(
            { doctorId: req.params.id },
            { chambers: chambers, surgeryLogs: surgeryLogs },
            { new: true }
        );
        res.status(200).json({ message: "Practice Management Updated!", doctor: updatedDoctor });
    } catch (error) { res.status(500).json({ error: "Failed to update practice logs." }); }
});

// ==========================================
// 💊 3. ADVANCED CLINICAL PHARMACOPOEIA
// ==========================================
router.get('/drugs/seed', async (req, res) => {
    const initialDrugs = [
        { brandName: "Napa", genericName: "Paracetamol", strength: "500mg", form: "Tablet", indications: "Fever, Mild to Moderate Pain", defaultDose: "1+1+1", childDose: "10-15 mg/kg per dose every 4-6 hours", renalDose: "Increase dosing interval to 8 hours if GFR < 10 mL/min", administration: "Can be taken with or without food.", sideEffects: "Rarely skin rash, hepatotoxicity in overdose." },
        { brandName: "Seclo", genericName: "Omeprazole", strength: "20mg", form: "Capsule", indications: "Gastric Ulcer, GERD, Acidity", defaultDose: "1+0+1", childDose: "1 mg/kg once daily", renalDose: "No dose adjustment necessary.", administration: "Take 30 minutes before a meal.", sideEffects: "Headache, nausea, abdominal pain." },
        { brandName: "Flexi", genericName: "Ibuprofen", strength: "400mg", form: "Tablet", indications: "Inflammation, Muscle Pain, Osteoarthritis", defaultDose: "1+0+1", childDose: "5-10 mg/kg every 6-8 hours", renalDose: "Avoid in severe renal failure.", administration: "Must be taken immediately after meals to avoid gastric irritation.", sideEffects: "Gastritis, GI bleeding, dizziness." },
        { brandName: "Cef-3", genericName: "Cefixime", strength: "200mg", form: "Capsule", indications: "Typhoid, UTI, Respiratory Tract Infections", defaultDose: "1+0+1", childDose: "8 mg/kg/day in 1 or 2 divided doses", renalDose: "Reduce dose to 75% if GFR 21-60 mL/min.", administration: "Can be taken without regard to meals.", sideEffects: "Diarrhea, dyspepsia, hypersensitivity." }
    ];
    try {
        await Drug.deleteMany({}); 
        await Drug.insertMany(initialDrugs);
        res.status(200).json({ message: "Advanced Clinical Pharmacopoeia Seeded Successfully!" });
    } catch (err) { res.status(500).json({ error: "Seeding failed." }); }
});

router.get('/drugs/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    try {
        const results = await Drug.find({ brandName: { $regex: '^' + query, $options: 'i' } }).limit(5);
        res.json(results);
    } catch (err) { res.status(500).json({ error: "Search failed." }); }
});

// ==========================================
// 🏥 4. HOSPITAL OPERATIONS (Prescriptions & Patients)
// ==========================================
router.post('/prescriptions', async (req, res) => {
    const incomingData = req.body; 
    const secureOTP = Math.floor(100000 + Math.random() * 900000).toString();
    try {
        const newRecord = new Prescription({ recordId: "RX-" + Date.now(), otp: secureOTP, ...incomingData, timestamp: new Date().toISOString() });
        await newRecord.save();
        res.status(201).json({ message: "Success!", otp: secureOTP });
    } catch (error) { res.status(500).json({ error: "Vault lock failed." }); }
});

router.get('/prescriptions/:otp', async (req, res) => {
    try {
        const foundRecord = await Prescription.findOne({ otp: req.params.otp });
        foundRecord ? res.status(200).json(foundRecord) : res.status(404).json({ error: "Invalid OTP." });
    } catch (error) { res.status(500).json({ error: "Vault search failed." }); }
});

router.get('/patients/:id', async (req, res) => {
    try {
        const foundPatient = await Patient.findOne({ patientId: req.params.id });
        foundPatient ? res.status(200).json(foundPatient) : res.status(404).json({ error: "Patient not found." });
    } catch (error) { res.status(500).json({ error: "Vault search failed." }); }
});

router.post('/patients/:id/upload', upload.single('reportFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded." });
        const fileUrl = `https://holmes-erx-system.onrender.com/uploads/${req.file.filename}`;
        await Patient.findOneAndUpdate(
            { patientId: req.params.id },
            { $push: { medicalHistory: { fileName: req.file.originalname, url: fileUrl, uploadedAt: new Date() } } }
        );
        res.status(200).json({ message: "Report archived!", url: fileUrl, fileName: req.file.originalname });
    } catch (error) { res.status(500).json({ error: "File archiving failed." }); }
});

// ==========================================
// 📅 5. APPOINTMENT & BOOKING ENGINE
// ==========================================
router.get('/doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find({}, '-password'); 
        res.status(200).json(doctors);
    } catch (error) { res.status(500).json({ error: "Failed to fetch directory." }); }
});

router.post('/appointments', async (req, res) => {
    try {
        const { patientId, patientName, doctorId, doctorName, chamber, date } = req.body;
        
        const newAppt = new Appointment({
            appointmentId: "APT-" + Math.floor(100000 + Math.random() * 900000),
            patientId, patientName, doctorId, doctorName, chamber, date
        });
        
        await newAppt.save();
        res.status(201).json({ message: "Appointment booked successfully!", appointment: newAppt });
    } catch (error) { res.status(500).json({ error: "Booking failed." }); }
});

router.get('/appointments/doctor/:id', async (req, res) => {
    try {
        const appts = await Appointment.find({ doctorId: req.params.id, status: "Scheduled" }).sort({ date: 1 });
        res.status(200).json(appts);
    } catch (error) { res.status(500).json({ error: "Failed to fetch queue." }); }
});

module.exports = router;