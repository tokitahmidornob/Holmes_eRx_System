const mongoose = require('mongoose');

const pharmacistSchema = new mongoose.Schema({
    pharmacistId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    // 💊 Dispensary Verification
    pcbRegNumber: { type: String, default: "" }, // Pharmacy Council of Bangladesh
    tradeLicense: { type: String, default: "" }, 
    pharmacyName: { type: String, default: "" },
    pharmacyAddress: { type: String, default: "" },
    
    // 🏪 Operations
    operatingHours: { type: String, default: "" },
    emergencyAvailability: { type: Boolean, default: false },
    
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pharmacist', pharmacistSchema);