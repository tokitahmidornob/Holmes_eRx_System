const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');

// ==========================================
// 🧬 PHYSIOLOGICAL OPTIMIZER — AI DEPRESCRIBING ENGINE
// ==========================================
// Analyzes a patient's active medication regimen to identify
// redundant therapies, prescribing cascades, and unnecessary
// chemical burdens. Suggests safe tapering strategies.
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

// The strict clinical deprescribing system prompt
const OPTIMIZER_SYSTEM_PROMPT = `You are an elite Clinical Pharmacologist specializing in Deprescribing and Physiological Optimization. Review the provided patient profile, conditions, and current medications. Identify redundant therapies, 'prescribing cascades' (drugs treating side effects of other drugs), and unnecessary chemical burdens. You MUST respond with a raw JSON object formatted exactly like this: { "optimizationPossible": boolean, "chemicalBurdenAnalysis": "Brief summary of their current state", "taperingPlan": [ { "drug": "Name", "rationale": "Why to remove it", "strategy": "How to safely taper" } ], "optimizedBaseline": "Expected physiological state after optimization" }. Do not include markdown formatting or conversational text.`;

// ==========================================
// POST /analyze — The Optimization Analysis Endpoint
// ==========================================
router.post('/analyze', verifyToken, async (req, res) => {
    try {
        const { patientProfile, activeConditions, currentMedications } = req.body;

        // Validate that we have medication data to analyze
        if (!currentMedications || !Array.isArray(currentMedications) || currentMedications.length === 0) {
            return res.json({
                optimizationPossible: false,
                chemicalBurdenAnalysis: 'No active medications to analyze.',
                taperingPlan: [],
                optimizedBaseline: 'Patient has no current chemical burden.',
                optimizerBypassed: true,
                reason: 'No active medications provided for analysis.'
            });
        }

        // Check for API key availability
        if (!process.env.GEMINI_API_KEY) {
            console.warn('⚠️ OPTIMIZER: GEMINI_API_KEY not configured. Cannot run optimization.');
            return res.json({
                optimizationPossible: false,
                chemicalBurdenAnalysis: 'Optimizer AI not configured.',
                taperingPlan: [],
                optimizedBaseline: 'N/A',
                optimizerBypassed: true,
                reason: 'GEMINI_API_KEY not configured. Cannot perform AI analysis.'
            });
        }

        // Initialize the Gemini client
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Construct the clinical optimization prompt
        const optimizationPayload = `
PATIENT PROFILE:
========================
${JSON.stringify(patientProfile || {}, null, 2)}

ACTIVE CONDITIONS:
========================
${JSON.stringify(activeConditions || [], null, 2)}

CURRENT MEDICATIONS (ANALYZE THESE FOR OPTIMIZATION):
========================
${JSON.stringify(currentMedications, null, 2)}

Perform a full deprescribing analysis:
1. Identify any redundant or duplicate therapies
2. Detect 'prescribing cascades' — drugs prescribed to treat side effects of other drugs
3. Flag medications with questionable risk-benefit ratios given the patient's conditions
4. Assess overall chemical burden and polypharmacy risk
5. Propose safe tapering strategies for any medications that can be reduced or eliminated

Respond with ONLY the JSON object. No markdown, no explanation.`;

        // Call Gemini 2.5 Flash
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: optimizationPayload,
            config: {
                systemInstruction: OPTIMIZER_SYSTEM_PROMPT,
                temperature: 0.15, // Low temperature for deterministic clinical analysis
            }
        });

        // Extract the response text
        const rawText = response.text.trim();

        // Parse the JSON response — strip any accidental markdown fences
        let cleanedText = rawText;
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.slice(7);
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.slice(3);
        }
        if (cleanedText.endsWith('```')) {
            cleanedText = cleanedText.slice(0, -3);
        }
        cleanedText = cleanedText.trim();

        const optimizerResult = JSON.parse(cleanedText);

        // Validate the parsed structure
        if (typeof optimizerResult.optimizationPossible !== 'boolean' || !Array.isArray(optimizerResult.taperingPlan)) {
            throw new Error('Optimizer returned malformed result structure.');
        }

        return res.json({
            optimizationPossible: optimizerResult.optimizationPossible,
            chemicalBurdenAnalysis: optimizerResult.chemicalBurdenAnalysis || '',
            taperingPlan: optimizerResult.taperingPlan || [],
            optimizedBaseline: optimizerResult.optimizedBaseline || '',
            optimizerBypassed: false
        });

    } catch (err) {
        // ==========================================
        // 🚨 FAILSAFE: If AI fails, return error state.
        // ==========================================
        console.error('❌ OPTIMIZER AI FAILURE:', err.message || err);
        return res.json({
            optimizationPossible: false,
            chemicalBurdenAnalysis: 'Optimizer AI encountered an error during analysis.',
            taperingPlan: [],
            optimizedBaseline: 'N/A',
            optimizerBypassed: true,
            reason: `Optimizer AI unavailable: ${err.message || 'Unknown error'}. Please retry or consult manually.`
        });
    }
});

module.exports = router;
