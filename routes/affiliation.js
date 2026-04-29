const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { PractitionerRole, Organization, Location, Person } = require('../models/GridModels');


const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied.' });
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        next();
    } catch (err) { res.status(401).json({ msg: 'Invalid Token.' }); }
};

/**
 * 🏥 ASSIGN PRACTITIONER TO ORGANIZATION
 * Logic: Links a Person to an Organization and specific sites.
 */
router.post('/assign', authenticate, async (req, res) => {
    try {
        const { orgId, locationIds, specialty, subSpecialty } = req.body;

        // Step 1: Find the existing Practitioner record
        let roleRecord = await PractitionerRole.findOne({ personId: req.user.id });
        
        if (!roleRecord) {
            return res.status(404).json({ msg: 'Practitioner identity not initialized.' });
        }

        // Step 2: Update the Role with Organization & Site assignments
        roleRecord.orgId = orgId;
        roleRecord.locationAssignments = locationIds; // Array of Location IDs
        roleRecord.specialty = specialty;
        roleRecord.subSpecialty = subSpecialty;
        
        // Step 3: Mark as Pending Verification (requires Org Admin approval)
        roleRecord.audit.verificationStatus = 'Pending';
        roleRecord.audit.updatedAt = Date.now();

        await roleRecord.save();

        res.status(200).json({ 
            msg: 'Affiliation Synchronized. Practitioner now linked to Organization.',
            status: 'Pending_Admin_Verification'
        });

    } catch (err) {
        console.error("AFFILIATION_ERR:", err);
        res.status(500).json({ msg: 'Grid Affiliation Failure.' });
    }
});

/**
 * 🏢 GET MY CURRENT AFFILIATIONS
 */
router.get('/my-status', authenticate, async (req, res) => {
    try {
        const role = await PractitionerRole.findOne({ personId: req.user.id })
            .populate('orgId', 'orgName orgType')
            .populate('locationAssignments', 'physicalAddress siteId');
        res.json(role);
    } catch (err) {
        res.status(500).json({ msg: 'Grid Directory Unreachable.' });
    }
});

module.exports = router;