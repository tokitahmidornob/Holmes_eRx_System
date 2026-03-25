const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    doctorId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    // 🩺 Professional Bangladeshi Credentials
    bmdcRegNumber: { type: String, default: "" }, // Bangladesh Medical and Dental Council
    degrees: { type: [String], default: [] },
    specialty: { type: String, default: "" },
    designation: { type: String, default: "" },
    workplace: { type: String, default: "" },
    
    // 🏢 Logistics & Trust Markers
    consultationHours: { type: String, default: "" },
    chamberLocation: { type: String, default: "" },
    surgicalLogCount: { type: Number, default: 0 }, // Public trust metric
    digitalSignatureUrl: { type: String, default: "" }, // For stamping PDF prescriptions
    
    isProfileComplete: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Doctor', doctorSchema);