const { Prescription, Patient, Person, PractitionerRole } = require('../models/GridModels');

exports.decryptPayload = async (req, res) => {
    try {
        if (req.user.role !== 'pharmacist' && req.user.role !== 'doctor') {
            return res.status(403).json({ msg: 'Pharmacy Clearance Required.' });
        }

        const { broadcastId, otp } = req.body;

        if (!broadcastId || !otp) {
            return res.status(400).json({ msg: 'Broadcast ID and OTP are strictly required for decryption.' });
        }

        const rx = await Prescription.findOne({ broadcastId: broadcastId.toUpperCase() })
            .populate({
                path: 'patientId',
                populate: { path: 'personId', select: 'legalFullName contact genderLegal dateOfBirth' }
            })
            .populate({
                path: 'practitionerRoleId',
                populate: { path: 'personId', select: 'legalFullName contact' }
            });

        if (!rx) return res.status(404).json({ msg: 'Payload not found on the National Grid.' });

        if (rx.otp !== otp) {
            return res.status(401).json({ msg: 'OTP Mismatch. Decryption Halted.' });
        }

        res.json({
            _id: rx._id,
            broadcastId: rx.broadcastId,
            status: rx.status,
            issuedAt: rx.createdAt,
            medications: rx.medications,
            patientName: rx.patientId.personId.legalFullName,
            patientPhone: rx.patientId.personId.contact.primaryMobile,
            doctorName: rx.practitionerRoleId.personId.legalFullName
        });

    } catch (err) {
        console.error("DECRYPTION_ERR:", err);
        res.status(500).json({ msg: 'Grid Decryption Failure.' });
    }
};

exports.dispensePrescription = async (req, res) => {
    try {
        if (req.user.role !== 'pharmacist') return res.status(403).json({ msg: 'Pharmacy Clearance Required.' });

        const rx = await Prescription.findById(req.params.rxId);
        if (!rx) return res.status(404).json({ msg: 'Prescription not found.' });

        if (rx.status === 'Dispensed') {
            return res.status(400).json({ msg: 'FRAUD ALERT: This prescription has already been dispensed.' });
        }

        rx.status = 'Dispensed';
        await rx.save();

        res.json({ msg: 'Prescription officially marked as Dispensed. Chain of custody severed.' });

    } catch (err) {
        console.error("DISPENSE_ERR:", err);
        res.status(500).json({ msg: 'Grid Update Failure.' });
    }
};
