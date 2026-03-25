const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
    brand_name: { type: String, required: true },
    generic: { type: String, required: true },
    strength: String,
    dosage_form: String,
    manufacturer: String
});

// Create an index so searching 21k records is lightning fast
MedicineSchema.index({ brand_name: 'text', generic: 'text' });

module.exports = mongoose.model('Medicine', MedicineSchema);