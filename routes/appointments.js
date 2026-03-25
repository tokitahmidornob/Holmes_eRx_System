const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const User = require('../models/User');

// @route   POST /api/appointments/add-chamber
// @desc    Doctor adds a new chamber to their profile
router.post('/add-chamber', async (req, res) => {
    try {
        const { doctorId, chamberData } = req.body;
        const doctor = await User.findById(doctorId);
        
        doctor.chambers.push(chamberData);
        await doctor.save();
        
        res.json({ success: true, chambers: doctor.chambers });
    } catch (err) { res.status(500).json({ error: "Failed to update Chamber." }); }
});

// @route   POST /api/appointments/book
// @desc    Patient books an appointment and gets a Token Number
router.post('/book', async (req, res) => {
    try {
        const { patientId, doctorId, chamberDetails, appointmentDate, timeSlot, symptoms } = req.body;

        // SMART QUEUE SYSTEM: Count how many people already booked this doctor on this date
        const existingBookings = await Appointment.countDocuments({
            doctorId,
            appointmentDate: new Date(appointmentDate)
        });

        // Generate the next token in line
        const tokenNumber = existingBookings + 1;

        const newAppointment = new Appointment({
            patientId,
            doctorId,
            chamberDetails,
            appointmentDate: new Date(appointmentDate),
            timeSlot,
            symptoms,
            tokenNumber
        });

        await newAppointment.save();
        res.status(201).json({ success: true, appointment: newAppointment });

    } catch (err) { res.status(500).json({ error: "Failed to secure booking." }); }
});

// @route   GET /api/appointments/doctor/:id
// @desc    Get all appointments for a specific doctor's dashboard
router.get('/doctor/:id', async (req, res) => {
    try {
        // Fetch appointments and attach patient names
        const appointments = await Appointment.find({ doctorId: req.params.id })
            .populate('patientId', 'name email')
            .sort({ appointmentDate: 1 }); // Sort by upcoming dates
        res.json(appointments);
    } catch (err) { res.status(500).json({ error: "Grid Fetch Failed" }); }
});

module.exports = router;