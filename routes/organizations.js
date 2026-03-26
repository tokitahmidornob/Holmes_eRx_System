const express = require('express');
const router = express.Router();
const { Organization, Location, AuditEvent } = require('./models/GridModels'); // Assuming GridModels is in root
const { logAudit } = require('./middleware/auditLogger');

/**
 * 🏛️ REGISTER NATIONAL ORGANIZATION
 * Logic: Hospitals, Pharmacies, and Labs must be registered before 
 * practitioners can be assigned to them.
 */
router.post('/register', async (req, res) => {
    try {
        const { name, type, dghsId, taxId, email, phone } = req.body;

        // Step 1: Check for existing Org ID
        const existingOrg = await Organization.findOne({ orgIdentifier: dghsId });
        if (existingOrg) return res.status(400).json({ msg: 'Organization already registered in Grid.' });

        // Step 2: Create Organization Master Record
        const newOrg = new Organization({
            orgIdentifier: dghsId,
            orgName: name,
            orgType: type,
            taxId: taxId,
            contactChannels: { email, phone },
            audit: { 
                verificationStatus: 'Pending',
                sourceOfTruth: 'Directorate_General_Health_Services' 
            }
        });

        const savedOrg = await newOrg.save();

        res.status(201).json({ 
            msg: 'Organization Initialized. Pending physical site verification.',
            orgId: savedOrg._id 
        });

    } catch (err) {
        console.error("ORG_REG_ERR:", err);
        res.status(500).json({ msg: 'Grid Organization Failure.' });
    }
});

/**
 * 📍 ADD PHYSICAL LOCATION (SITE)
 * Logic: An organization (e.g. Dhaka Medical) can have multiple 
 * physical sites (Outpatient, Emergency, Surgical Wing).
 */
router.post('/:orgId/location', async (req, res) => {
    try {
        const { siteName, address, lat, lng } = req.body;

        const newLocation = new Location({
            orgId: req.params.orgId,
            siteId: `SITE-${Math.floor(1000 + Math.random() * 9000)}`,
            physicalAddress: address,
            gpsCoordinates: { lat, lng },
            audit: { verificationStatus: 'Unverified' }
        });

        await newLocation.save();
        res.status(201).json({ msg: 'Physical Site attached to Organization Profile.' });

    } catch (err) {
        res.status(500).json({ msg: 'Location Attachment Failure.' });
    }
});

/**
 * 🔍 FETCH VERIFIED ORGANIZATIONS
 * Used by doctors/pharmacists to pick their affiliation.
 */
router.get('/verified', async (req, res) => {
    try {
        const orgs = await Organization.find({ 'audit.verificationStatus': 'Verified' }).select('orgName orgType orgIdentifier');
        res.json(orgs);
    } catch (err) {
        res.status(500).json({ msg: 'Grid Directory Unreachable.' });
    }
});

module.exports = router;