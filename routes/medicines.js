const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 🌟 UNIVERSAL SCHEMA PATCH 🌟
// By using { strict: false }, we force Mongoose to fetch EVERY column in your database, 
// even if we don't know the exact spelling of the column name!
const Medicine = mongoose.models.Medicine || mongoose.model('Medicine', new mongoose.Schema({
    brandName: String
}, { strict: false }), 'medicines');

router.get('/', async (req, res) => {
    try {
        const query = req.query.search;
        if (!query) return res.json([]);

        // Search by brand name
        const drugs = await Medicine.find({ 
            brandName: { $regex: query, $options: 'i' } 
        }).limit(15);

        res.json(drugs);
    } catch (err) {
        console.error("Drug Search Error:", err);
        res.status(500).json({ msg: "Database connection failed." });
    }
});

module.exports = router;