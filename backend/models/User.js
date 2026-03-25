const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['doctor', 'patient', 'pharmacist'], required: true },
    
    // Core Profile Data
    designation: String,
    department: String,
    degrees: [String],
    specialties: [String],
    experienceYears: Number,
    visitingHours: String,
    biography: String,
    licenseNumber: String, // For both Dr and Pharmacist

    // Surgery Log (For Doctors)
    surgeryLog: [{
        title: String,
        date: { type: Date, default: Date.now },
        outcome: { type: String, enum: ['Successful', 'Complicated', 'Critical'] },
        notes: String
    }]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);