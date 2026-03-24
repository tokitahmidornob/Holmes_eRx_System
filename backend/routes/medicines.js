const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');

// POST: Add a new medicine to the database (For our testing)
router.post('/add', async (req, res) => {
    try {
        const { brandName, genericName, dosageForm, strength } = req.body;
        const newMedicine = new Medicine({ brandName, genericName, dosageForm, strength });
        const savedMedicine = await newMedicine.save();
        res.status(201).json({ success: true, data: savedMedicine });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// GET: The "Auto-Suggest" Search Engine
router.get('/search', async (req, res) => {
    try {
        // We use req.query.q so the URL looks like: /api/medicines/search?q=napa
        const searchQuery = req.query.q;
        
        if (!searchQuery) {
            return res.status(200).json([]); // Return empty list if nothing typed
        }

        // Search the vault: Look for matches in BOTH brand name and generic name
        const results = await Medicine.find({
            $or: [
                { brandName: new RegExp(searchQuery, 'i') }, // 'i' means case-insensitive
                { genericName: new RegExp(searchQuery, 'i') }
            ]
        }).limit(10); // Limit to top 10 results for lightning-fast frontend performance

        res.status(200).json({ success: true, results });
    } catch (error) {
        console.error("❌ Medicine Search Error:", error);
        res.status(500).json({ success: false, error: "Database search failed." });
    }
});

module.exports = router;