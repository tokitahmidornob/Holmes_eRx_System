const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');

// @route   GET /api/medicines/search
// @desc    Search for medicines by brand or generic name
// @route   GET /api/medicines/search
// @route   GET /api/medicines/search
router.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);

    try {
        // MATCHING THE EXACT VAULT DNA
        const results = await Medicine.find({
            $or: [
                { brandName: { $regex: query, $options: 'i' } },
                { genericName: { $regex: query, $options: 'i' } }
            ]
        }).limit(15);

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Search failed" });
    }
});

module.exports = router;