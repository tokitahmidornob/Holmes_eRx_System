const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');

// ==========================================
// 🛡️ SENTINEL — AI INTERACTION SAFETY NET
// ==========================================
// Intercepts prescriptions before final submission to detect
// lethal drug interactions, contraindications, and severe
// allergic reactions via Gemini 2.5 Flash.
// ==========================================

// Cryptographic Identity Check (matches project pattern)
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: "Grid Access Denied." });
    try {
        req.user = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'holmes_emergency_grid_secret_2026');
        next();
    } catch (err) { res.status(400).json({ msg: "Invalid Identity Token." }); }
};

// The strict clinical system prompt
const SENTINEL_SYSTEM_PROMPT = `You are the IntelliScript BD Interaction Sentinel, an expert clinical toxicologist AI operating on a national health grid. Analyze the proposed stagedMedications against the patient's currentMedications, activeConditions, and allergies. You must identify critical, life-threatening prescribing cascades, severe drug-drug interactions, or contraindications. Do not flag minor side effects; flag only fatal or severe clinical risks. Return your analysis strictly as a JSON object: { "safe": boolean, "criticalAlerts": [ "String explaining the exact chemical danger and clinical recommendation" ] }`;

// ==========================================
// POST /check — The Sentinel Scan Endpoint
// ==========================================
router.post('/check', verifyToken, async (req, res) => {
    try {
        const { stagedMedications, allergies, activeConditions, currentMedications } = req.body;

        // Validate that we have something to check
        if (!stagedMedications || !Array.isArray(stagedMedications) || stagedMedications.length === 0) {
            return res.json({ safe: true, criticalAlerts: [], sentinelBypassed: true, reason: 'No staged medications to analyze.' });
        }

        // Check for API key availability
        if (!process.env.GEMINI_API_KEY) {
            console.warn('⚠️ SENTINEL: GEMINI_API_KEY not configured. Bypassing safety scan.');
            return res.json({
                safe: true,
                criticalAlerts: [],
                sentinelBypassed: true,
                reason: 'Sentinel AI not configured. Manual review required.'
            });
        }

        // Initialize the Gemini client
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Construct the clinical analysis prompt with patient context
        const clinicalPayload = `
PATIENT CLINICAL CONTEXT:
========================
KNOWN ALLERGIES: ${JSON.stringify(allergies || [], null, 2)}

ACTIVE CONDITIONS: ${JSON.stringify(activeConditions || [], null, 2)}

CURRENT MEDICATIONS (already being taken): ${JSON.stringify(currentMedications || [], null, 2)}

NEW MEDICATIONS BEING PRESCRIBED (REVIEW THESE):
${JSON.stringify(stagedMedications, null, 2)}

Analyze the new medications against ALL of the above patient data. Check for:
1. Drug-drug interactions between new meds AND current meds
2. Drug-allergy conflicts (substance matches against known allergies)
3. Drug-condition contraindications (e.g. NSAIDs with renal failure)
4. Duplicate therapy risks
5. Lethal dosage combinations

Respond with ONLY the JSON object. No markdown, no explanation.`;

        // Call Gemini 2.5 Flash
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: clinicalPayload,
            config: {
                systemInstruction: SENTINEL_SYSTEM_PROMPT,
                temperature: 0.1, // Low temperature for deterministic clinical analysis
            }
        });

        // Extract the response text
        const rawText = response.text.trim();

        // Parse the JSON response — strip any accidental markdown fences
        let cleanedText = rawText.trim();
        const jsonMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (jsonMatch) {
            cleanedText = jsonMatch[1];
        } else {
            cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        }
        cleanedText = cleanedText.trim();

        const sentinelVerdict = JSON.parse(cleanedText);

        // Validate the parsed structure
        if (typeof sentinelVerdict.safe !== 'boolean' || !Array.isArray(sentinelVerdict.criticalAlerts)) {
            throw new Error('Sentinel returned malformed verdict structure.');
        }

        return res.json({
            safe: sentinelVerdict.safe,
            criticalAlerts: sentinelVerdict.criticalAlerts,
            sentinelBypassed: false
        });

    } catch (err) {
        // ==========================================
        // 🚨 FAILSAFE: If AI fails, allow bypass.
        // We CANNOT let an AI outage prevent emergency prescribing.
        // ==========================================
        console.error('❌ SENTINEL AI FAILURE:', err.message || err);
        return res.json({
            safe: true,
            criticalAlerts: [],
            sentinelBypassed: true,
            reason: `Sentinel AI unavailable: ${err.message || 'Unknown error'}. Manual clinical review required.`
        });
    }
});

module.exports = router;
