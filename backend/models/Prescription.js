const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    prescriptionId: { type: String, required: true, unique: true }, 
    otp: { type: String, required: true }, 
    
    doctorId: { type: String, required: true }, 
    doctorName: { type: String, default: "Medical Professional" },
    
    patientName: { type: String, required: true },
    patientAge: { type: Number },
    patientGender: { type: String },
    
    medicines: [{
        brandName: String,
        genericName: String,
        dosageForm: String,
        dose: String,        
        duration: String,    
        instruction: String  
    }],

    tests: [{
        testName: String
    }],
    
    status: { type: String, enum: ['Issued', 'Fulfilled'], default: 'Issued' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prescription', prescriptionSchema);