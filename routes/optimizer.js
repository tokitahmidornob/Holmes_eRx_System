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
const OPTIMIZER_SYSTEM_PROMPT = `You are the IntelliScript BD Physiological Optimizer. Your objective is to actively reduce patient bio-load and reverse prescribing cascades. Analyze the provided clinical dossier. Identify redundant therapies and medications that are chemically burdening the patient without providing net-positive clinical value. Return a JSON object containing optimizationPossible (boolean), a brief chemicalBurdenAnalysis, and a taperingPlan array detailing exactly which drug to remove, the rationale, and the safe tapering strategy.`;

// ==========================================
// POST /analyze — The Optimization Analysis Endpoint
// ==========================================
router.post('/analyze', verifyToken, async (req, res) => {
    console.log("Diagnostic: GEMINI_API_KEY exists?", !!process.env.GEMINI_API_KEY);
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

        // Check for API key availability (loosened for Vercel edge cases)
        if (process.env.GEMINI_API_KEY === undefined || process.env.GEMINI_API_KEY === 'undefined') {
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
        let cleanedText = rawText.trim();
        const jsonMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (jsonMatch) {
            cleanedText = jsonMatch[1];
        } else {
            cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
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
            error: true,
            chemicalBurdenAnalysis: 'Optimizer AI encountered an error during analysis.',
            taperingPlan: [],
            optimizedBaseline: 'N/A',
            optimizerBypassed: true,
            reason: `Optimizer AI unavailable: ${err.message || 'Unknown error'}. Please retry or consult manually.`
        });
    }
});

module.exports = router;
