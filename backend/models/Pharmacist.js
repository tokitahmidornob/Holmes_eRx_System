const mongoose = require('mongoose');

const pharmacistSchema = new mongoose.Schema({
    pharmacistId: { type: String, required: true, unique: true, index: true }, 
    name: { type: String, required: true, trim: true }, 
    email: { type: String, required: true, unique: true, lowercase: true, trim: true }, 
    password: { type: String, required: true },
    
    // Professional Details
    employeeId: { type: String, trim: true }, 
    contactNumber: { type: String, trim: true }, 
    licenseNumber: { type: String, trim: true }, 
    branchLocation: { type: String, trim: true }, 
    
    degrees: { type: [String], default: [] }, 
    experienceYears: { type: Number, min: 0, default: 0 }, 
    biography: { type: String, trim: true }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Pharmacist', pharmacistSchema);