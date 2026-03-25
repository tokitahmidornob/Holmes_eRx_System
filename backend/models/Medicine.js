const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    brandName: { type: String, required: true }, // e.g., "Napa Extend"
    genericName: { type: String, required: true }, // e.g., "Paracetamol"
    manufacturer: { type: String, default: "" }, // e.g., "Beximco Pharmaceuticals"
    
    // 💊 Clinical Details
    strength: { type: String, default: "" }, // e.g., "665mg"
    dosageForm: { type: String, default: "Tablet" }, // Tablet, Capsule, Syrup, IV
    dosageDescription: { type: String, default: "" }, // The massive reference paragraph
    
    // 🧠 Smart Engine Auto-Fill Data
    indications: { type: [String], default: [] }, // e.g., ["Fever", "Body Ache"]
    defaultDose: { type: String, default: "1+0+1" }, 
    administrationInstruction: { type: String, default: "After meal" },
    
    // ⚠️ Safety Warnings
    sideEffects: { type: [String], default: [] },
    contraindications: { type: [String], default: [] }, // When NOT to prescribe
    
    pricePerUnit: { type: Number, default: 0 }, // For the pharmacy invoice
    createdAt: { type: Date, default: Date.now }
});

// ⚡ THE MASTER INDEX: This makes searching 100x faster!
medicineSchema.index({ brandName: 1, genericName: 1 });

module.exports = mongoose.model('Medicine', medicineSchema);