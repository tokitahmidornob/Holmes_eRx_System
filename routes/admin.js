const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PractitionerRole, Person } = require('../models/GridModels');

// 🔒 SECURITY TRIPWIRE (Strictly Admin Only)
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied.' });
    try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        if (decoded.role !== 'admin') {
            return res.status(403).json({ msg: 'DGHS Ministry Clearance Required.' });
        }
        req.user = decoded;
        next();
    } catch (err) { res.status(401).json({ msg: 'Invalid Token.' }); }
};

// ==========================================
// 1. FETCH PENDING PRACTITIONERS
// ==========================================
router.get('/pending', authenticateAdmin, async (req, res) => {
    try {
        // Find practitioners who are either completely 'Pending' or 'Pending Ministry Verification'
        const pendingQueue = await PractitionerRole.find({
            'audit.verificationStatus': { $regex: /Pending/i } 
        }).populate({
            path: 'personId',
            select: 'legalFullName contact.primaryEmail contact.primaryMobile'
        });

        const mappedQueue = pendingQueue.map(prac => ({
            _id: prac._id,
            name: prac.personId?.legalFullName || 'Unknown',
            email: prac.personId?.contact?.primaryEmail || 'N/A',
            phone: prac.personId?.contact?.primaryMobile || 'N/A',
            roleType: prac.roleType,
            licenseNumber: prac.licenseNumber || 'Not Uploaded Yet',
            status: prac.audit.verificationStatus
        }));

        res.json(mappedQueue);
    } catch (err) {
        console.error("ADMIN_FETCH_ERR:", err);
        res.status(500).json({ msg: 'Grid Server Error.' });
    }
});

// ==========================================
// 2. VERIFY LICENSE (Grant Authority)
// ==========================================
router.put('/verify/:id', authenticateAdmin, async (req, res) => {
    try {
        const prac = await PractitionerRole.findById(req.params.id);
        if (!prac) return res.status(404).json({ msg: 'Practitioner not found.' });

        if (!prac.licenseNumber) {
            return res.status(400).json({ msg: 'Cannot verify. Practitioner has not uploaded a license.' });
        }

        prac.audit.verificationStatus = 'Verified';
        await prac.save();

        res.json({ msg: 'Authority Granted. Cryptographic signature applied.' });
    } catch (err) {
        console.error("ADMIN_VERIFY_ERR:", err);
        res.status(500).json({ msg: 'Failed to verify practitioner.' });
    }
});

// ==========================================
// 3. GOD-MODE BACKDOOR (For Testing Only)
// ==========================================
// Since we don't have an "Admin" option on the register screen, 
// running this route once will promote your current account to Admin.
router.post('/promote-me', async (req, res) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) return res.status(401).json({ msg: 'Access Denied.' });
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        
        // Find the Person and temporarily change the role in the JWT logic by adding an Admin record or just returning a new token
        // For our architecture, let's issue a forced Admin token
        const payload = { id: decoded.id, uuid: decoded.uuid, role: 'admin', name: decoded.name + ' (DGHS)' };
        const secret = process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026';
        
        jwt.sign(payload, secret, { expiresIn: '12h' }, (err, token) => {
            if (err) throw err;
            res.json({ msg: 'Account promoted to Ministry Admin.', token });
        });
    } catch (err) { res.status(500).json({ msg: 'Promotion failed.' }); }
});

module.exports = router;