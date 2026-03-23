const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient', // This links the prescription to our Patient model
        required: true
    },
    doctorName: {
        type: String,
        required: true,
        default: "Dr. Sherlock Holmes" // Default for our testing
    },
    medications: [{
        name: { type: String, required: true },
        dosage: { type: String, required: true },    // e.g., "500mg"
        frequency: { type: String, required: true }, // e.g., "1+0+1" or "Twice daily"
        duration: { type: String, required: true },  // e.g., "7 days"
        instructions: String                         // e.g., "After meals"
    }],
    diagnosis: {
        type: String,
        required: true
    },
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Prescription', prescriptionSchema);