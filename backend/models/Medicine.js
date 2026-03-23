const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    brandName: { 
        type: String, 
        required: true,
        trim: true 
    },
    genericName: { 
        type: String, 
        required: true,
        trim: true
    },
    dosageForm: { 
        type: String, // e.g., Tablet, Syrup, Injection
        default: "Tablet"
    },
    strength: { 
        type: String, // e.g., 500mg, 120mg
        required: true
    }
});

module.exports = mongoose.model('Medicine', medicineSchema);