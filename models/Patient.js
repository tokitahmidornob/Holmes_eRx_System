const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    patientId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    // 🧑‍🤝‍🧑 Citizen Identity
    nidNumber: { type: String, default: "" }, // National ID
    age: { type: Number },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Other' },
    bloodGroup: { type: String, default: "" },
    
    // 📊 Clinical Baseline
    vitals: {
        heightCm: { type: Number },
        weightKg: { type: Number },
        bmi: { type: Number }
    },
    
    // 🏥 Medical History Vault
    medicalHistory: {
        allergies: { type: [String], default: [] },
        chronicConditions: { type: [String], default: [] }, // e.g., Diabetes, Hypertension
        pastSurgeries: { type: [String], default: [] }
    },
    
    contact: { type: String, default: "" },
    address: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Patient', patientSchema);