const express = require('express');
const router = express.Router();
const User = require('../models/User');

// @route   PUT /api/patients/profile/:id
// @desc    Update patient vital stats and contact info
router.put('/profile/:id', async (req, res) => {
    try {
        const { weight, bloodGroup, bloodPressure, phone, allergies } = req.body;
        const updatedUser = await User.findByIdAndUpdate(req.params.id, {
            $set: {
                'patientDetails.weight': weight,
                'patientDetails.bloodGroup': bloodGroup,
                'patientDetails.bloodPressure': bloodPressure,
                'patientDetails.phone': phone,
                'patientDetails.allergies': allergies
            }
        }, { new: true });
        res.json({ success: true, user: updatedUser });
    } catch (err) {
        res.status(500).json({ error: "Profile synchronization failed." });
    }
});

module.exports = router;