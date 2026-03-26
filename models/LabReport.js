const mongoose = require('mongoose');

const LabReportSchema = new mongoose.Schema({
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', required: true },
    patientId: { type: String, required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pathologistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    testName: { type: String, required: true },
    resultValue: { type: String, required: true },
    unit: { type: String, default: 'N/A' },
    referenceRange: { type: String, default: 'N/A' },
    clinicalNotes: { type: String },
    
    status: { type: String, enum: ['Completed'], default: 'Completed' },

    // 🌟 THE UPGRADE: The PDF Storage Vault (Base64 String) 🌟
    pdfReport: { type: String } 

}, { timestamps: true });

module.exports = mongoose.model('LabReport', LabReportSchema);