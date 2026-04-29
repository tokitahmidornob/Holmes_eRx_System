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
//
// ARCHITECTURE:
//   LAYER 1 — Deterministic Pre-Flight Rules Engine (always runs)
//   LAYER 2 — Gemini LLM Deep Analysis (runs if API key available)
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

// ==========================================
// 🔬 LAYER 1: DETERMINISTIC PHARMACOLOGY ENGINE
// Hardcoded clinical knowledge base for guaranteed,
// LLM-independent detection of critical interactions.
// These rules ALWAYS fire, regardless of AI availability.
// ==========================================

/**
 * Cross-Reactivity Map: Allergy → list of drugs that are contraindicated.
 * Keys are allergy substances (lowercase). Values are arrays of drug name
 * fragments (lowercase) that share structural/pharmacological cross-reactivity.
 */
const CROSS_REACTIVITY_MAP = {
    // Beta-lactam antibiotics: penicillin allergy → all aminopenicillins & combos
    'penicillin': [
        'amoxicillin', 'amoxil', 'moxacil',
        'augmentin', 'co-amoxiclav', 'amoxiclav',
        'ampicillin', 'cloxacillin', 'flucloxacillin',
        'piperacillin', 'tazobactam',
        'cephalexin', 'cefazolin', 'ceftriaxone', 'cefixime' // ~10% cross-reactivity
    ],
    'amoxicillin': ['augmentin', 'co-amoxiclav', 'amoxiclav', 'amoxil', 'moxacil'],
    'sulfa': ['sulfamethoxazole', 'trimethoprim', 'co-trimoxazole', 'bactrim', 'septrin'],
    'aspirin': ['ibuprofen', 'naproxen', 'diclofenac', 'ketoprofen', 'indomethacin'],
};

/**
 * Condition → Contraindicated drug fragments map.
 * Key: active condition name fragment (lowercase).
 * Value: array of objects { drug, reason }.
 */
const CONDITION_CONTRAINDICATION_MAP = [
    // Beta-blockers are absolutely contraindicated in asthma (bronchospasm risk)
    {
        conditions: ['asthma', 'bronchial asthma', 'reactive airway'],
        drugs: [
            { fragment: 'propranolol',  reason: 'CONTRAINDICATION: Propranolol is a non-selective beta-blocker. In asthmatic patients, it blocks β2-adrenoceptors in bronchial smooth muscle, precipitating severe, potentially fatal bronchospasm. Non-selective beta-blockers are ABSOLUTELY CONTRAINDICATED in asthma. Use a cardioselective agent (e.g., bisoprolol) only if clinically essential, with extreme caution.' },
            { fragment: 'atenolol',     reason: 'CAUTION: Atenolol (cardioselective beta-blocker) must be used with extreme caution in asthma. Risk of bronchospasm exists, especially at higher doses. Confirm diagnosis and monitor closely.' },
            { fragment: 'metoprolol',   reason: 'CAUTION: Metoprolol (cardioselective beta-blocker) carries bronchospasm risk in asthmatic patients, especially at higher doses. Monitor respiratory status closely.' },
            { fragment: 'carvedilol',   reason: 'CONTRAINDICATION: Carvedilol is a non-selective beta-blocker. Absolutely contraindicated in asthma — high risk of fatal bronchospasm.' },
            { fragment: 'labetalol',    reason: 'CONTRAINDICATION: Labetalol has non-selective beta-blockade activity. Contraindicated in asthma due to bronchospasm risk.' },
            { fragment: 'sotalol',      reason: 'CONTRAINDICATION: Sotalol is a non-selective beta-blocker, contraindicated in asthma.' },
        ]
    },
    // NSAIDs are dangerous in renal failure
    {
        conditions: ['renal failure', 'chronic kidney disease', 'ckd', 'aki', 'acute kidney injury', 'nephropathy'],
        drugs: [
            { fragment: 'ibuprofen',   reason: 'CONTRAINDICATION: Ibuprofen (NSAID) inhibits prostaglandin-mediated renal afferent arteriolar dilation, causing acute kidney injury in patients with pre-existing renal impairment.' },
            { fragment: 'diclofenac',  reason: 'CONTRAINDICATION: Diclofenac is contraindicated in severe renal failure due to NSAID-related nephrotoxicity.' },
            { fragment: 'naproxen',    reason: 'CONTRAINDICATION: Naproxen (NSAID) is contraindicated in significant renal impairment.' },
            { fragment: 'ketoprofen',  reason: 'CONTRAINDICATION: Ketoprofen (NSAID) is contraindicated in renal failure.' },
        ]
    },
    // Fluoroquinolones in QT prolongation / arrhythmia
    {
        conditions: ['qt prolongation', 'arrhythmia', 'long qt syndrome', 'torsades'],
        drugs: [
            { fragment: 'ciprofloxacin', reason: 'CAUTION: Ciprofloxacin can prolong the QT interval. Use with extreme caution in patients with pre-existing QT prolongation or arrhythmia.' },
            { fragment: 'levofloxacin',  reason: 'CONTRAINDICATION: Levofloxacin has significant QT-prolonging potential. Contraindicated in patients with known QT prolongation disorders.' },
            { fragment: 'moxifloxacin',  reason: 'CONTRAINDICATION: Moxifloxacin is among the highest-risk fluoroquinolones for QT prolongation. Absolutely contraindicated in arrhythmia/long QT syndrome.' },
        ]
    },
];

/**
 * Duplicate Therapy / Pharmacological Equivalence Map.
 * Grouped by active therapeutic class.
 * Key: representative display name. Value: array of drug name fragments.
 */
const DUPLICATE_THERAPY_GROUPS = [
    {
        class: 'Paracetamol / Acetaminophen Analgesics',
        warning: 'DUPLICATE THERAPY / HEPATOTOXICITY RISK: The patient already has an active Paracetamol-containing medication. Prescribing an additional paracetamol/acetaminophen product creates a risk of cumulative hepatotoxicity and fatal liver failure. The combined daily dose must not exceed 4g (2g in hepatically compromised patients). Review and consolidate to a single agent.',
        drugs: [
            'paracetamol', 'acetaminophen', 'napa', 'ace', 'tylenol', 'napa extend', 'napa extra',
            'ace plus', 'napa plus', 'renova', 'fast', 'tafen'
        ]
    },
    {
        class: 'Proton Pump Inhibitors (PPIs)',
        warning: 'DUPLICATE THERAPY: Patient already has an active PPI. Prescribing a second PPI provides no additional clinical benefit and doubles cost and side-effect risk (hypomagnesaemia, C. difficile risk).',
        drugs: [
            'omeprazole', 'esomeprazole', 'pantoprazole', 'lansoprazole', 'rabeprazole',
            'seclo', 'losectil', 'esoral', 'pantop', 'nexium'
        ]
    },
    {
        class: 'Statin (HMG-CoA Reductase Inhibitor) Therapy',
        warning: 'DUPLICATE THERAPY / RHABDOMYOLYSIS RISK: Patient already has an active statin. Prescribing a second statin dramatically increases risk of myopathy and life-threatening rhabdomyolysis.',
        drugs: [
            'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin', 'fluvastatin',
            'lipitor', 'crestor', 'zocor'
        ]
    },
];

/**
 * The deterministic pre-flight check function.
 * Runs before the LLM call and returns any guaranteed violations.
 * @returns {{ safe: boolean, criticalAlerts: string[] }}
 */
function runPreFlightRulesEngine({ stagedMedications, allergies, activeConditions, currentMedications }) {
    const alerts = [];

    const stagedNames  = (stagedMedications  || []).map(m => (m.brandName || m.drugName || m.display || m.name || '').toLowerCase());
    const allergyNames = (allergies          || []).map(a => (a.substance || a).toString().toLowerCase());
    const condNames    = (activeConditions    || []).map(c => (typeof c === 'string' ? c : c.conditionName || c.name || '').toLowerCase());
    const currentNames = (currentMedications  || []).map(m => (typeof m === 'string' ? m : m.drugName || m.drug || m.brandName || m.display || m.name || '').toLowerCase());

    // ── RULE 1: Cross-Reactivity Allergy Check ──────────────────────────────
    for (const allergyRaw of allergyNames) {
        // Find if this allergy key (or a fragment of it) is in our map
        for (const [mapKey, contraindicated] of Object.entries(CROSS_REACTIVITY_MAP)) {
            if (!allergyRaw.includes(mapKey) && !mapKey.includes(allergyRaw)) continue;

            for (const staged of stagedNames) {
                for (const contraFragment of contraindicated) {
                    if (staged.includes(contraFragment) || contraFragment.includes(staged.replace(/\s+\d+mg.*/i, '').trim())) {
                        alerts.push(
                            `⚠️ CROSS-REACTIVITY ALLERGY ALERT: Patient has a documented allergy to [${allergyRaw.toUpperCase()}]. ` +
                            `Prescribing [${staged.toUpperCase()}] is contraindicated — these agents share beta-lactam ring structure / ` +
                            `pharmacological cross-reactivity with ${mapKey.toUpperCase()}. Risk of anaphylaxis or severe hypersensitivity. ` +
                            `Choose a structurally unrelated antibiotic (e.g., azithromycin, doxycycline, or a fluoroquinolone if appropriate).`
                        );
                    }
                }
            }
        }
    }

    // ── RULE 2: Drug-Condition Contraindications ────────────────────────────
    for (const condEntry of CONDITION_CONTRAINDICATION_MAP) {
        const conditionMatched = condEntry.conditions.some(condFragment =>
            condNames.some(c => c.includes(condFragment))
        );
        if (!conditionMatched) continue;

        const matchedCond = condEntry.conditions.find(cf => condNames.some(c => c.includes(cf)));

        for (const staged of stagedNames) {
            for (const drugEntry of condEntry.drugs) {
                if (staged.includes(drugEntry.fragment)) {
                    alerts.push(
                        `🚫 CONDITION CONTRAINDICATION [${matchedCond.toUpperCase()}]: ${drugEntry.reason}`
                    );
                }
            }
        }
    }

    // ── RULE 3: Duplicate Therapy Detection ────────────────────────────────
    for (const group of DUPLICATE_THERAPY_GROUPS) {
        // Check if patient already has a drug from this group in current meds
        const activeDrugInGroup = currentNames.find(curr =>
            group.drugs.some(frag => curr.includes(frag) || frag.includes(curr.replace(/\s+\d+mg.*/i, '').trim()))
        );
        if (!activeDrugInGroup) continue;

        // Now check if we are trying to prescribe another drug from the same group
        for (const staged of stagedNames) {
            const isAlreadySameAsActive = staged.includes(activeDrugInGroup) || activeDrugInGroup.includes(staged.replace(/\s+\d+mg.*/i, '').trim());
            const stagedIsInGroup = group.drugs.some(frag => staged.includes(frag) || frag.includes(staged.replace(/\s+\d+mg.*/i, '').trim()));

            if (stagedIsInGroup && !isAlreadySameAsActive) {
                alerts.push(
                    `🔁 ${group.warning} ` +
                    `(Active: [${activeDrugInGroup.toUpperCase()}] | New Prescription: [${staged.toUpperCase()}])`
                );
            }
        }
    }

    return { safe: alerts.length === 0, criticalAlerts: alerts };
}

// ==========================================
// 🤖 LAYER 2: ENHANCED GEMINI SYSTEM PROMPT
// Instructs the LLM on all three clinical domains
// that the rules engine may have missed.
// ==========================================
const SENTINEL_SYSTEM_PROMPT = `You are the IntelliScript BD Interaction Sentinel, the Chief Clinical Toxicologist AI of a sovereign national health grid. Your sole function is to protect patient lives by analyzing proposed prescriptions against patient clinical dossiers.

You MUST check for the following critical clinical domains:

1. CROSS-REACTIVITY ALLERGIES:
   - Penicillin allergy → contraindicated: ALL aminopenicillins (amoxicillin, ampicillin), beta-lactamase inhibitor combos (Augmentin/co-amoxiclav), and use ~10% cephalosporin cross-reactivity caution.
   - Sulfonamide allergy → contraindicated: sulfamethoxazole, co-trimoxazole, trimethoprim-sulfamethoxazole combinations.
   - Aspirin/NSAID allergy → contraindicated: all NSAIDs (ibuprofen, diclofenac, naproxen, ketoprofen).
   - Do NOT rely on name matching alone. Reason pharmacologically about shared structural classes.

2. DRUG-CONDITION CONTRAINDICATIONS:
   - Asthma/COPD/Reactive Airway Disease → NON-SELECTIVE BETA-BLOCKERS (propranolol, carvedilol, sotalol, labetalol) are ABSOLUTELY CONTRAINDICATED. They block bronchial β2-receptors, precipitating fatal bronchospasm. Cardioselective agents (bisoprolol, metoprolol) require caution.
   - Renal Failure/CKD → NSAIDs (ibuprofen, diclofenac) are contraindicated (nephrotoxicity).
   - QT Prolongation/Arrhythmia → Fluoroquinolones (moxifloxacin, levofloxacin), antiarrhythmics that further prolong QT.
   - Pregnancy → Tetracyclines, fluoroquinolones, thalidomide, ACE inhibitors in 2nd/3rd trimester.
   - Peptic Ulcer Disease → NSAIDs, corticosteroids without PPI cover.

3. DUPLICATE THERAPY & HEPATOTOXICITY:
   - If currentMedications includes ANY paracetamol/acetaminophen-containing product (Napa, Napa Extend, Ace Plus, Tylenol, Tafen, Fast), prescribing ANOTHER paracetamol product (Paracetamol, Ace, Napa Extra, Renova) constitutes DUPLICATE THERAPY with cumulative hepatotoxicity risk. FLAG IT.
   - If currentMedications includes a statin and another statin is prescribed → rhabdomyolysis risk.
   - If currentMedications includes a PPI and another PPI is prescribed → unnecessary duplicate therapy.

4. LETHAL DRUG-DRUG INTERACTIONS:
   - Warfarin + NSAIDs → severe bleeding.
   - MAOIs + SSRIs/TCAs → serotonin syndrome.
   - Digoxin + amiodarone → digoxin toxicity.
   - Metformin + IV contrast agents → lactic acidosis.

RETURN ONLY a valid JSON object in this exact format. No markdown, no explanations outside the JSON:
{ "safe": boolean, "criticalAlerts": [ "Detailed clinical explanation with pharmacological mechanism and recommendation" ] }

If no critical risks are found, return: { "safe": true, "criticalAlerts": [] }
Only flag SEVERE or FATAL risks. Do NOT flag minor side effects or non-critical interactions.`;

// ==========================================
// POST /check — The Sentinel Scan Endpoint
// Dual-Layer Architecture:
//   Layer 1: Deterministic Pre-Flight Engine (always runs, zero API cost)
//   Layer 2: Gemini LLM Deep Scan (runs only if pre-flight passes)
// ==========================================
router.post('/check', verifyToken, async (req, res) => {
    console.log("🛡️ SENTINEL: Scan initiated. GEMINI_API_KEY exists?", !!process.env.GEMINI_API_KEY);
    const { stagedMedications, allergies, activeConditions, currentMedications } = req.body;

    // Validate that we have something to check
    if (!stagedMedications || !Array.isArray(stagedMedications) || stagedMedications.length === 0) {
        return res.json({ safe: true, criticalAlerts: [], sentinelBypassed: true, reason: 'No staged medications to analyze.' });
    }

    // ==========================================
    // 🔬 LAYER 1: DETERMINISTIC PRE-FLIGHT CHECK
    // Always runs. Catches the three critical test scenarios
    // with zero latency and zero API cost.
    // ==========================================
    const preFlightResult = runPreFlightRulesEngine({ stagedMedications, allergies, activeConditions, currentMedications });
    console.log(`🔬 PRE-FLIGHT: ${preFlightResult.criticalAlerts.length} alert(s) found deterministically.`);

    // If the rules engine already caught critical violations, return immediately.
    // Skip the Gemini call entirely (faster response, saves API quota).
    if (!preFlightResult.safe) {
        console.log('🚨 PRE-FLIGHT BLOCK: Prescription halted by deterministic rules engine. Gemini call skipped.');
        return res.json({
            safe: false,
            criticalAlerts: preFlightResult.criticalAlerts,
            sentinelBypassed: false,
            layer: 'DETERMINISTIC_RULES_ENGINE'
        });
    }

    // ==========================================
    // 🤖 LAYER 2: GEMINI LLM DEEP SCAN
    // Only runs if pre-flight passed. Catches complex or
    // unusual interactions beyond the hardcoded knowledge base.
    // ==========================================

    // If no API key, return the pre-flight result (safe at this point)
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'undefined') {
        console.warn('⚠️ SENTINEL: GEMINI_API_KEY not configured. Returning pre-flight result.');
        return res.json({
            safe: true,
            criticalAlerts: [],
            sentinelBypassed: true,
            reason: 'AI Deep Scan not configured. Deterministic pre-flight passed. Manual pharmacist review recommended.',
            layer: 'PRE_FLIGHT_ONLY'
        });
    }

    try {
        // Initialize the Gemini client
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // Construct the enhanced clinical analysis prompt
        const clinicalPayload = `PATIENT CLINICAL DOSSIER FOR SENTINEL ANALYSIS:
==============================================
DOCUMENTED ALLERGIES: ${JSON.stringify(allergies || [], null, 2)}

ACTIVE CLINICAL CONDITIONS: ${JSON.stringify(activeConditions || [], null, 2)}

CURRENT ACTIVE MEDICATIONS (already being taken by this patient): ${JSON.stringify(currentMedications || [], null, 2)}

NEW MEDICATIONS BEING PRESCRIBED NOW — ANALYZE THESE:
${JSON.stringify(stagedMedications, null, 2)}

INSTRUCTIONS:
Perform a deep pharmacological analysis. The deterministic rules engine has already run. 
Your role is to catch anything it may have missed:
1. Cross-reactivity allergies (especially penicillin → amoxicillin/augmentin)
2. Drug-condition contraindications (especially non-selective beta-blockers → asthma)
3. Duplicate therapy / hepatotoxicity (especially paracetamol stacking: Napa Extend + Paracetamol)
4. Novel drug-drug interactions not covered by simple rule matching
5. Lethal dosage combinations

Respond with ONLY the JSON object. No markdown, no preamble, no explanation outside JSON.`;

        // Call Gemini 2.5 Flash with low temperature for deterministic output
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: clinicalPayload,
            config: {
                systemInstruction: SENTINEL_SYSTEM_PROMPT,
                temperature: 0.1,
            }
        });

        // Extract and clean the response text
        const rawText = response.text.trim();
        let cleanedText = rawText;
        const jsonMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (jsonMatch) {
            cleanedText = jsonMatch[1];
        } else {
            cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        }
        cleanedText = cleanedText.trim();

        const geminiVerdict = JSON.parse(cleanedText);

        // Validate the Gemini response structure
        if (typeof geminiVerdict.safe !== 'boolean' || !Array.isArray(geminiVerdict.criticalAlerts)) {
            throw new Error('Gemini returned malformed verdict structure.');
        }

        // Merge pre-flight alerts with Gemini alerts (deduplicate by content)
        const mergedAlerts = [...preFlightResult.criticalAlerts, ...geminiVerdict.criticalAlerts];
        const finalSafe = preFlightResult.safe && geminiVerdict.safe;

        console.log(`✅ GEMINI SCAN COMPLETE: ${geminiVerdict.criticalAlerts.length} additional alert(s) from LLM.`);

        return res.json({
            safe: finalSafe,
            criticalAlerts: mergedAlerts,
            sentinelBypassed: false,
            layer: 'FULL_DUAL_LAYER'
        });

    } catch (err) {
        // ==========================================
        // 🚨 FAILSAFE: Gemini failed (503, timeout, JSON parse error, etc.)
        // Return the pre-flight result as the fallback.
        // We CANNOT let an AI outage block emergency prescribing.
        // The UI NEVER crashes — it always gets a valid JSON response.
        // ==========================================
        console.error('❌ SENTINEL GEMINI FAILURE:', err.message || err);

        // Pre-flight passed at this point (otherwise we would have returned early).
        // Return a "bypassed" response so the frontend shows a warning toast.
        return res.json({
            safe: true,
            criticalAlerts: preFlightResult.criticalAlerts,
            sentinelBypassed: true,
            reason: `AI Deep Scan unavailable (${err.message || 'Unknown error'}). Deterministic pre-flight passed. Manual clinical review required.`,
            layer: 'PRE_FLIGHT_FALLBACK'
        });
    }
});

module.exports = router;
