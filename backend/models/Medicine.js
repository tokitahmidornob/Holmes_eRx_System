const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    brandName: { type: String, required: true, index: true }, 
    genericName: String, 
    strength: String, 
    form: String, 
    indications: String, 
    defaultDose: String, 
    childDose: String, 
    renalDose: String, 
    administration: String, 
    sideEffects: String
});

// We name it 'Medicine' to match our new routes, but it uses the 'Drug' fields
module.exports = mongoose.model('Medicine', medicineSchema);