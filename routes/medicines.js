const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 🌟 UPGRADED SCHEMA: Now pulling full clinical metadata
const Medicine = mongoose.models.Medicine || mongoose.model('Medicine', new mongoose.Schema({
    brandName: String,
    genericName: String,
    strength: String,
    indications: String,    // The medical use case
    sideEffects: String,    // Known adverse effects
    dosage: String,         // Default adult dosage
    administration: String  // How it should be taken
}), 'medicines');

router.get('/', async (req, res) => {
    try {
        const query = req.query.search;
        if (!query) return res.json([]);

        // Searching by brand name, limiting to top 15 results for optimal speed
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