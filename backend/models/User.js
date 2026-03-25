const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        enum: ['doctor', 'patient', 'pharmacist', 'pathologist'], 
        required: true 
    },
    // 🌟 NEW: The Unique Grid Identification Number
    gridId: { 
        type: String, 
        unique: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);