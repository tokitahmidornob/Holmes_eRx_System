const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');

// @route   GET /api/medicines/search
// @desc    Search for medicines by brand or generic name
router.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 3) return res.json([]);

    try {
        // Search for medicines that START with the query (fastest for auto-complete)
        const results = await Medicine.find({
            $or: [
                { brand_name: { $regex: `^${query}`, $options: 'i' } },
                { generic: { $regex: `^${query}`, $options: 'i' } }
            ]
        }).limit(10); // Only return top 10 to keep the UI clean

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Search failed" });
    }
});

module.exports = router;