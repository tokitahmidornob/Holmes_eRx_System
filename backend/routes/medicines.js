const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// We use a dynamic schema to talk to your existing 'medicines' collection
const Medicine = mongoose.model('Medicine', new mongoose.Schema({
    brandName: String,
    genericName: String,
    strength: String
}), 'medicines'); // 'medicines' matches your MongoDB collection name

router.get('/', async (req, res) => {
    try {
        const query = req.query.search;
        if (!query) return res.json([]);

        // Powerful regex search: looks for the name anywhere in the string, case-insensitive
        const drugs = await Medicine.find({
            brandName: { $regex: query, $options: 'i' }
        }).limit(10); // Limit to top 10 for speed

        res.json(drugs);
    } catch (err) {
        console.error("Drug Search Error:", err);
        res.status(500).json({ msg: "Database connection failed." });
    }
});

module.exports = router;