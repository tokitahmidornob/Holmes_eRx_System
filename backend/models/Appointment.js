const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Where is the appointment?
    chamberDetails: {
        hospitalName: String,
        location: String,
        roomNumber: String
    },
    
    // When is the appointment?
    appointmentDate: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    
    // The Astonishing Additions: Virtual Triage & Smart Queue
    symptoms: { type: String, required: true },
    tokenNumber: { type: Number, required: true },
    
    // Live Tracking Status
    status: { 
        type: String, 
        enum: ['Pending Review', 'Confirmed', 'Completed', 'Cancelled'], 
        default: 'Pending Review' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Appointment', AppointmentSchema);