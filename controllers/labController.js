const LabReport = require('../models/LabReport');
const { Prescription } = require('../models/GridModels');
const { GoogleGenAI } = require('@google/genai');

exports.uploadLabReport = async (req, res) => {
    try {
        const { prescriptionId, testName, resultValue, unit, referenceRange, pdfReport, ai_summary } = req.body;

        const originalRx = await Prescription.findById(prescriptionId);
        if (!originalRx) {
            return res.status(404).json({ msg: "Fatal Error: Original Prescription not found in Grid." });
        }

        const newReport = new LabReport({
            prescriptionId: originalRx._id,
            patientId: originalRx.patientId,          
            doctorId: originalRx.doctorId,            
            pathologistId: req.user.id,               
            testName,
            resultValue,
            unit: unit || 'N/A',
            referenceRange: referenceRange || 'N/A',
            pdfReport,                                
            ai_summary                                
        });

        const savedReport = await newReport.save();
        res.status(201).json(savedReport);
    } catch (err) {
        console.error("Lab Upload Error:", err);
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
};

exports.getLabsForPrescription = async (req, res) => {
    try {
        const labs = await LabReport.find({ prescriptionId: req.params.rxId })
            .populate('pathologistId', 'name') 
            .sort({ createdAt: -1 });
        res.json(labs);
    } catch (err) {
        res.status(500).json({ msg: `Server Error: ${err.message}` });
    }
};

exports.generateAISummary = async (req, res) => {
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
};
