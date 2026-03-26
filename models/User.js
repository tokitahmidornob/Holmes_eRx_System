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
        enum: ['doctor', 'patient', 'pharmacist', 'pathologist', 'admin'], // Added 'admin'
        required: true 
    },
    gridId: { 
        type: String, 
        unique: true 
    },
    // 🌟 NEW: The Security Clearance Status 🌟
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);