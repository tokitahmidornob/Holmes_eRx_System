const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({ recordId: String, otp: String, patientId: String, medications: Array, tests: Array, timestamp: String });
const Prescription = mongoose.model('Prescription', prescriptionSchema);

const patientSchema = new mongoose.Schema({
    patientId: { type: String, required: true, unique: true }, 
    name: String, email: { type: String, required: true, unique: true }, password: { type: String, required: true },
    age: Number, bloodGroup: String, contact: String, medicalHistory: Array, registeredAt: { type: Date, default: Date.now }
});
const Patient = mongoose.model('Patient', patientSchema);

const doctorSchema = new mongoose.Schema({
    doctorId: { type: String, required: true, unique: true }, 
    name: String, email: { type: String, required: true, unique: true }, password: { type: String, required: true }, 
    department: String, designation: String, degrees: Array, specialties: Array, 
    experienceYears: Number, biography: String, profilePictureUrl: String, 
    isProfileComplete: { type: Boolean, default: true }, 
    chambers: { type: Array, default: [] },    
    surgeryLogs: { type: Array, default: [] }, 
    joinedAt: { type: Date, default: Date.now }
});
const Doctor = mongoose.model('Doctor', doctorSchema);

const pharmacistSchema = new mongoose.Schema({
    pharmacistId: { type: String, required: true, unique: true }, name: String, email: { type: String, required: true, unique: true }, password: { type: String, required: true },
    licenseNumber: String, degrees: Array, experienceYears: Number, biography: String, joinedAt: { type: Date, default: Date.now }
});
const Pharmacist = mongoose.model('Pharmacist', pharmacistSchema);

const drugSchema = new mongoose.Schema({
    brandName: { type: String, required: true }, genericName: String, strength: String, form: String, 
    indications: String, defaultDose: String, childDose: String, renalDose: String, administration: String, sideEffects: String
});
const Drug = mongoose.model('Drug', drugSchema);

// 📅 NEW: THE APPOINTMENT BLUEPRINT
const appointmentSchema = new mongoose.Schema({
    appointmentId: { type: String, required: true, unique: true },
    patientId: String,
    patientName: String,
    doctorId: String,
    doctorName: String,
    chamber: String,
    date: String, // Format: YYYY-MM-DD
    status: { type: String, default: "Scheduled" }, // Scheduled, Completed, or Cancelled
    bookedAt: { type: Date, default: Date.now }
});
const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = { Prescription, Patient, Doctor, Pharmacist, Drug, Appointment };