const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Ensure GEMINI_API_KEY is defined in the .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/analyze', async (req, res) => {
    try {
        const patientData = req.body.patientData || {};
        const prescriptions = req.body.prescriptions || [];

        // Defensive early exit if no meds are provided
        if (prescriptions.length === 0) {
            return res.json({ status: 'safe', alertMessage: 'No active medications to analyze.' });
        }

        // Use the fast, cost-effective flash model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        
        // The Master Prompt: Forces Gemini into a strict JSON-only response
        const prompt = `
            You are an AI Clinical Sentinel. Analyze the following patient data and proposed prescriptions for lethal drug interactions or severe allergic reactions.
            Patient History: ${JSON.stringify(patientData)}
            Proposed Prescriptions: ${JSON.stringify(prescriptions)}
            
            You must respond ONLY with a valid JSON object. Do not include markdown formatting or conversational text. 
            Format: {"status": "danger" | "safe" | "warning", "alertMessage": "Brief, clinical explanation of the interaction"}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Armor: Strip markdown code blocks (```json ... ```) if Gemini hallucinated them
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResult = JSON.parse(cleanText);

        res.status(200).json(parsedResult);

    } catch (error) {
        console.error('Sentinel Node Failure:', error);
        // We return a 500 so the frontend catch block knows to trigger the Stage-Safe mock data
        res.status(500).json({ error: 'Sentinel processing failed.' });
    }
});

module.exports = router;
