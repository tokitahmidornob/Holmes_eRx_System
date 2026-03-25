const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['doctor', 'patient', 'pharmacist', 'pathologist'], required: true },
    
    // Core Profile Data
    designation: String,
    department: String,
    degrees: [String],
    specialties: [String],
    experienceYears: Number,
    biography: String,
    licenseNumber: String,

    // --- NEW: CHAMBER MANAGEMENT ---
    chambers: [{
        hospitalName: String,
        location: String,      // e.g., "Dhanmondi, Dhaka"
        fullAddress: String,
        roomNumber: String,
        visitingDays: [String], // e.g., ["Monday", "Wednesday", "Friday"]
        timeSlot: String,      // e.g., "5:00 PM - 9:00 PM"
        maxPatients: { type: Number, default: 30 }
    }],

    // --- NEW: CITIZEN HEALTH VAULT ---
    patientDetails: {
        weight: String,
        bloodGroup: String,
        bloodPressure: String,
        phone: String,
        allergies: String
    },

    // Surgery Log (For Doctors)
    surgeryLog: [{
        title: String,
        date: { type: Date, default: Date.now },
        outcome: { type: String, enum: ['Successful', 'Complicated', 'Critical'] },
        notes: String
    }]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);