const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Dynamic model for your 'medicines' collection
const Medicine = mongoose.models.Medicine || mongoose.model('Medicine', new mongoose.Schema({
    brandName: String,
    genericName: String,
    strength: String
}), 'medicines');

router.get('/', async (req, res) => {
    try {
        const query = req.query.search;
        if (!query) return res.json([]);
        const drugs = await Medicine.find({ brandName: { $regex: query, $options: 'i' } }).limit(10);
        res.json(drugs);
    } catch (err) {
        res.status(500).json({ msg: "Database connection failed." });
    }
});

module.exports = router;