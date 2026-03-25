const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');

// --- 💊 SMART DRUG ENGINE ROUTES ---

// 1. The High-Speed Search API (For the Doctor's Dropdown)
// The frontend will call this like: GET /api/medicines/search?query=nap
router.get('/search', async (req, res) => {
    try {
        const searchQuery = req.query.query;
        
        // If the doctor hasn't typed anything yet, return an empty array
        if (!searchQuery) {
            return res.status(200).json({ success: true, data: [] });
        }

        // 🔍 SEARCH LOGIC: Look for matches in Brand Name OR Generic Name
        // $regex allows partial matches (e.g., "sec" finds "Seclo")
        // $options: 'i' makes it case-insensitive (ignores capital letters)
        const medicines = await Medicine.find({
            $or: [
                { brandName: { $regex: searchQuery, $options: 'i' } },
                { genericName: { $regex: searchQuery, $options: 'i' } }
            ]
        }).limit(15); // ⚡ Limit to 15 results so the dropdown doesn't lag the browser

        res.status(200).json({ success: true, data: medicines });
    } catch (error) {
        console.error("Drug Search Error:", error);
        res.status(500).json({ success: false, error: "Database query failed." });
    }
});

// 2. Add a New Drug (For System Admins to populate the database)
router.post('/', async (req, res) => {
    try {
        const newMed = new Medicine(req.body);
        await newMed.save();
        res.status(201).json({ success: true, message: "Drug secured in the vault!", data: newMed });
    } catch (error) {
        console.error("Drug Addition Error:", error);
        res.status(500).json({ success: false, error: "Failed to add drug." });
    }
});

// 3. Get Full Drug Details (For safety checks)
router.get('/:id', async (req, res) => {
    try {
        const med = await Medicine.findById(req.params.id);
        if (!med) return res.status(404).json({ success: false, error: "Drug not found." });
        res.status(200).json({ success: true, data: med });
    } catch (error) {
        res.status(500).json({ success: false, error: "Database error." });
    }
});

module.exports = router;