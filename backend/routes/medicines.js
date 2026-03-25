const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');

// @route   GET /api/medicines/search
// @desc    Search for medicines by brand or generic name
// @route   GET /api/medicines/search
router.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);

    try {
        // Removed the '^' so it searches ANYWHERE in the string, highly robust
        const results = await Medicine.find({
            $or: [
                { brand_name: { $regex: query, $options: 'i' } },
                { generic: { $regex: query, $options: 'i' } }
            ]
        }).limit(15); // Increased to 15 results

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Search failed" });
    }
});

module.exports = router;