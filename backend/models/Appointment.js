const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    appointmentId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true }, 
    patientName: { type: String, required: true },
    
    doctorId: { type: String, required: true, index: true }, 
    doctorName: { type: String, required: true },
    
    chamber: { type: String },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    
    status: { 
        type: String, 
        enum: ['Scheduled', 'Completed', 'Cancelled', 'No-Show'], 
        default: 'Scheduled' 
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Appointment', appointmentSchema);