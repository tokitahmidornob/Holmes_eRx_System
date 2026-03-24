const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    doctorId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true // ⚡ Speeds up directory searches dramatically
    }, 
    name: { type: String, required: true }, 
    email: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true,
        trim: true
    }, 
    password: { type: String, required: true }, 
    
    // Professional Details
    contactNumber: { type: String, trim: true }, 
    licenseNumber: { type: String, trim: true }, 
    department: { type: String, trim: true }, 
    designation: { type: String, trim: true }, 
    
    // Arrays for multiple qualifications
    degrees: { type: [String], default: [] }, 
    specialties: { type: [String], default: [] }, 
    
    experienceYears: { type: Number, min: 0, default: 0 }, 
    biography: { type: String, trim: true }, 
    profilePictureUrl: { type: String }, 
    
    isProfileComplete: { type: Boolean, default: false }, 
    
    // Practice Management
    chambers: { type: Array, default: [] },    
    consultationHours: { type: String },       
    surgeryLogs: { type: Array, default: [] }
    
}, { 
    timestamps: true // 🕒 Automatically manages createdAt and updatedAt
});

module.exports = mongoose.model('Doctor', doctorSchema);