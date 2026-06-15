const express = require('express');
const router = express.Router();
const LabReport = require('../models/LabReport');
const { Prescription } = require('../models/GridModels');
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');
// Security Tripwire
const authenticate = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'Access Denied.' });
    try {
        const token = authHeader.split(' ')[1];
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Invalid Token.' });
    }
};

// ==========================================
// 🔬 PATHOLOGIST: UPLOAD NEW LAB REPORT
// ==========================================
router.post('/', authenticate, async (req, res) => {
    try {
        const { prescriptionId, testName, resultValue, unit, referenceRange, pdfReport, ai_summary } = req.body;

        // 🔍 Detective Work: Find the original prescription to link the Doctor and Patient
        const originalRx = await Prescription.findById(prescriptionId);
        if (!originalRx) {
            return res.status(404).json({ msg: "Fatal Error: Original Prescription not found in Grid." });
        }

        const newReport = new LabReport({
            prescriptionId: originalRx._id,
            patientId: originalRx.patientId,          // Linked automatically!
            doctorId: originalRx.doctorId,            // Linked automatically!
            pathologistId: req.user.id,               // Grabbed from Pathologist's login token!
            testName,
            resultValue,
            unit: unit || 'N/A',
            referenceRange: referenceRange || 'N/A',
            pdfReport,                                // The Base64 PDF String
            ai_summary                                // The LLM AI Summary Object
        });

        const savedReport = await newReport.save();
        res.status(201).json(savedReport);
    } catch (err) {
        console.error("Lab Upload Error:", err);
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

// ==========================================
// 🩺 DOCTOR/PATIENT: FETCH LABS FOR A SPECIFIC RX
// ==========================================
router.get('/prescription/:rxId', authenticate, async (req, res) => {
    try {
        const labs = await LabReport.find({ prescriptionId: req.params.rxId })
            .populate('pathologistId', 'name') // Pulls the Pathologist's name for the Doctor to see
            .sort({ createdAt: -1 });
        res.json(labs);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
});

module.exports = router;

// ==========================================
// 🧠 AI DIAGNOSTIC SUMMARIZATION
// ==========================================
router.post('/generate-summary', authenticate, async (req, res) => {
    try {
        const { prescriptionId, testName, resultValue, unit, referenceRange, clinicalNotes } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(503).json({ msg: "AI Summary Unavailable: API Key missing." });
        }

        const originalRx = await Prescription.findById(prescriptionId);
        if (!originalRx) {
            return res.status(404).json({ msg: "Original Prescription not found." });
        }

        const medications = originalRx.medications.map(m => `${m.brandName} (${m.dosage})`).join(', ');

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const prompt = `
You are a highly intelligent medical AI. Analyze the following lab result in the context of the patient's active medications.
Lab Test: ${testName}
Result: ${resultValue} ${unit} (Reference Range: ${referenceRange})
Patient Active Medications: ${medications || 'None'}
Pathologist Notes: ${clinicalNotes || 'None'}

Please generate a concise JSON response strictly following this structure:
{
  "clinical_notes": "A brief analysis for the doctor, flagging specific biochemical anomalies or drug-test interactions.",
  "patient_summary": "A layman-friendly explanation of the results for the patient."
}
Return only valid JSON.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const text = response.text;
        const resultJson = JSON.parse(text);

        res.json(resultJson);
    } catch (err) {
        console.error("AI Generation Error:", err);
        res.status(500).json({ msg: "AI Summary Unavailable: Generation failed.", details: err.message });
    }
});