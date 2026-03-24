const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    patientId: { type: String, required: true, unique: true, index: true }, 
    name: { type: String, required: true, trim: true }, 
    email: { type: String, required: true, unique: true, lowercase: true, trim: true }, 
    password: { type: String, required: true },
    
    // Demographics & Contact
    age: { type: Number, min: 0 }, 
    gender: { type: String, enum: ['Male', 'Female', 'Other'] }, 
    bloodGroup: { type: String }, 
    contact: { type: String, trim: true }, 
    emergencyContact: { type: String, trim: true }, 
    address: { type: String }, 
    
    // Medical Profile
    allergies: { type: [String], default: [] }, 
    medicalHistory: { type: Array, default: [] }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Patient', patientSchema);