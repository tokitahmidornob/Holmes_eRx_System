const mongoose = require('mongoose');

const PrescriptionSchema = new mongoose.Schema({
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    patientId: { type: String, required: true }, // Using String since we are using Email/National ID for now
    broadcastId: { type: String, required: true, unique: true },
    otp: { type: String, required: true },
    
    // The Staging Area Arrays
    medications: [{
        brandName: String,
        generic: String,
        dosage: String,
        timing: String,
        duration: String,
        instruction: String
    }],
    investigations: [String],
    
    // State of the Prescription
    status: { type: String, enum: ['Active', 'Dispensed', 'Expired'], default: 'Active' },
    dispensedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dispensedAt: Date

}, { timestamps: true });

module.exports = mongoose.model('Prescription', PrescriptionSchema);