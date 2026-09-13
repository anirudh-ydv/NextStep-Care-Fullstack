require('dotenv').config();
console.log("DEBUG: Your API Key starts with:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 7) : "NOT FOUND");

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const { GoogleGenerativeAI } = require("@google/generative-ai");
const Patient = require('./models/Patient');

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));

// Allow test runner to skip DB connection
if (process.env.TEST_MODE !== 'true') {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("✅ Connected to the Database!"))
        .catch(err => console.error("❌ Database Connection Failed:", err));
}

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// ============================================================
//  🧠  NEXTSTEP-CARE CUSTOM PREDICTIVE TRIAGE ALGORITHM
//  Algorithm type : Weighted Multi-Parameter Risk Scoring
//                   with Linear Trend Detection (Least Squares)
//  Time Complexity : O(n)  — single pass over vitals history
//  Space Complexity: O(1)  — fixed memory, no extra arrays
// ============================================================

/**
 * normaliseVital()
 * Maps a raw vital reading onto a danger score between 0.0 and 1.0
 * using piecewise linear scaling against clinical reference ranges.
 *
 *   0.0  ──  safe zone   (within normal clinical bounds)
 *   0.5  ──  warning     (approaching dangerous boundary)
 *   1.0  ──  critical    (outside safe bounds entirely)
 *
 * @param {number} value      - Raw vital reading
 * @param {number} critLow    - Below this → immediate danger
 * @param {number} safeLow    - Lower boundary of safe range
 * @param {number} safeHigh   - Upper boundary of safe range
 * @param {number} critHigh   - Above this → immediate danger
 * @returns {number} danger score 0.0–1.0
 * Time Complexity: O(1)
 */
function normaliseVital(value, critLow, safeLow, safeHigh, critHigh) {
    if (value === null || value === undefined || isNaN(value)) return 0.5;
    if (value <= critLow || value >= critHigh) return 1.0;       // Critical zone
    if (value >= safeLow && value <= safeHigh) return 0.0;       // Safe zone
    if (value < safeLow)  return (safeLow  - value) / (safeLow  - critLow);   // Low-side warning
    return                        (value - safeHigh) / (critHigh - safeHigh); // High-side warning
}

/**
 * calculateTrend()
 * Detects whether a vital is WORSENING over time using
 * Ordinary Least Squares (OLS) linear regression.
 *
 * A positive return value means the vital is trending upward.
 * Caller decides if up is dangerous (e.g. BP rising = bad).
 *
 * Formula:
 *   slope = (n·ΣXY − ΣX·ΣY) / (n·ΣX² − (ΣX)²)
 *
 * @param {Array}  vitalsArray  - Ordered array of vital objects
 * @param {string} key          - Property name to trend (e.g. 'systolicBP')
 * @returns {number} Normalised slope clamped to [-1, +1]
 * Time Complexity: O(n) — single pass, no extra memory
 */
function calculateTrend(vitalsArray, key) {
    const n = vitalsArray.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
        const y = parseFloat(vitalsArray[i][key]) || 0;
        sumX  += i;
        sumY  += y;
        sumXY += i * y;
        sumX2 += i * i;
    }

    const denominator = (n * sumX2) - (sumX * sumX);
    if (denominator === 0) return 0;

    const slope = ((n * sumXY) - (sumX * sumY)) / denominator;

    // Normalise to [-1, +1]: divide by a clinically sensible scale
    return Math.max(-1, Math.min(1, slope / 10));
}

/**
 * calculateRiskScore()
 * Master scoring function — combines 5 vital parameters plus
 * a trend penalty into a single composite risk score.
 *
 * Clinical Weights (evidence-based for post-discharge patients):
 *   Systolic BP   : 30%  — #1 predictor of cardiac events post-discharge
 *   Heart Rate    : 25%  — reflects acute distress and arrhythmia risk
 *   Blood Sugar   : 20%  — critical for diabetic and post-surgical patients
 *   Hemoglobin    : 15%  — flags anaemia, internal bleeding, malnutrition
 *   Trend Penalty : 10%  — worsening trajectory increases risk even if
 *                          current values look borderline acceptable
 *
 * Risk Thresholds (calibrated against WHO post-discharge guidelines):
 *   score ≥ 0.65  → HIGH    (immediate physician review required)
 *   score ≥ 0.35  → MEDIUM  (monitor closely, schedule follow-up)
 *   score  < 0.35 → LOW     (stable, continue routine monitoring)
 *
 * @param {Object} latestVitals  - Most recent vital reading object
 * @param {Array}  allVitals     - Full vitals history array
 * @returns {Object} { score, riskLevel, riskLabel, breakdown, dataPoints }
 * Time Complexity: O(n)  — three trend calculations each O(n)
 * Space Complexity: O(1) — no auxiliary data structures
 */
function calculateRiskScore(latestVitals, allVitals) {
    // ── Step 1: Normalise each vital to a 0–1 danger score ──────────────────
    const bpScore = normaliseVital(
        latestVitals.systolic,
        70, 90, 130, 180   // critLow, safeLow, safeHigh, critHigh  (mmHg)
    );
    const hrScore    = normaliseVital(
        latestVitals.heartRate,
        40, 60, 100, 150   // (bpm)
    );
    const sugarScore = normaliseVital(
        latestVitals.sugar,
        50, 70, 140, 300   // (mg/dL)
    );
    const hemoScore  = normaliseVital(
        latestVitals.hemoglobin,
        6, 11, 17, 20      // (g/dL)
    );

    // ── Step 2: Trend detection — O(n) ──────────────────────────────────────
    // Positive slope on BP or HR or Sugar = patient is deteriorating
    const bpTrend    = Math.max(0, calculateTrend(allVitals, 'systolic'));
    const hrTrend    = Math.max(0, calculateTrend(allVitals, 'heartRate'));
    const sugarTrend = Math.max(0, calculateTrend(allVitals, 'sugar'));
    const trendScore = (bpTrend + hrTrend + sugarTrend) / 3;  // Average upward drift

    // ── Step 3: Weighted composite score ────────────────────────────────────
    const weightedScore =
        (bpScore    * 0.30) +
        (hrScore    * 0.25) +
        (sugarScore * 0.20) +
        (hemoScore  * 0.15) +
        (trendScore * 0.10);

    // ── Step 4: Risk classification ──────────────────────────────────────────
    let riskLevel, riskLabel;
    if      (weightedScore >= 0.65) { riskLevel = 'HIGH';   riskLabel = '🔴 CRITICAL'; }
    else if (weightedScore >= 0.35) { riskLevel = 'MEDIUM'; riskLabel = '🟡 MEDIUM';   }
    else                             { riskLevel = 'LOW';    riskLabel = '🟢 LOW';      }

    return {
        score:      parseFloat(weightedScore.toFixed(3)),
        riskLevel,
        riskLabel,
        dataPoints: allVitals.length,
        breakdown: {
            bloodPressureDanger: parseFloat((bpScore    * 100).toFixed(1)),
            heartRateDanger:     parseFloat((hrScore    * 100).toFixed(1)),
            bloodSugarDanger:    parseFloat((sugarScore * 100).toFixed(1)),
            hemoglobinDanger:    parseFloat((hemoScore  * 100).toFixed(1)),
            trendPenalty:        parseFloat((trendScore * 100).toFixed(1)),
        }
    };
}

// Export for unit testing
if (typeof module !== 'undefined') {
    module.exports.normaliseVital    = normaliseVital;
    module.exports.calculateTrend   = calculateTrend;
    module.exports.calculateRiskScore = calculateRiskScore;
}


// ==========================================
// 1. MULTIMODAL AI CHAT
// ==========================================
app.post('/api/patients/ai-chat', async (req, res) => {
    try {
        const { message, patientDisease, image } = req.body;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        let prompt = `You are a helpful medical assistant for a patient with ${patientDisease || 'general conditions'}. Provide short, reassuring, and practical advice. The user says: "${message}".`;
        let result;

        if (image) {
            prompt = `You are an AI vision assistant. A user has uploaded an image.
            Your task is to objectively describe exactly what you see in this image.
            CRITICAL INSTRUCTIONS:
            1. Do NOT provide any medical diagnosis.
            2. Do NOT give medical advice.
            3. Do NOT refuse to answer.
            Just describe the visual characteristics objectively (e.g., "I see a patch of redness," "I see a swollen area," "I see a pill bottle that says...").
            Always end your response with: "Note: This is an objective visual description by an AI, not a clinical diagnosis. Please consult your doctor."`;

            const base64Data = image.split(',')[1];
            const mimeType   = image.split(';')[0].split(':')[1];
            result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType } }]);
        } else {
            result = await model.generateContent(prompt);
        }

        res.status(200).json({ reply: result.response.text() });

    } catch (error) {
        console.error("Gemini AI Chat Error:", error);
        res.status(500).json({ reply: "I encountered an error processing that request. Please try again." });
    }
});


// ==========================================
// 2. AI PREDICTIVE TRIAGE  🧠
//    Step 1 — Custom weighted algorithm scores the patient (O(n))
//    Step 2 — Gemini explains the score in plain clinical English
// ==========================================
app.post('/api/patients/ai-predictive-triage', async (req, res) => {
    try {
        const { email } = req.body;

        // ── Fetch patient from MongoDB ───────────────────────────────────────
        const patient = await Patient.findOne({ email });

        if (!patient || !patient.historicalVitals || patient.historicalVitals.length === 0) {
            return res.status(400).json({
                analysis: "Not enough historical vital data to run an accurate AI triage. Please log at least one vitals entry first."
            });
        }

        const allVitals    = patient.historicalVitals;
        const latestVitals = allVitals[allVitals.length - 1];

        // ── Step 1: Run custom algorithm ─────────────────────────────────────
        // O(n) time, O(1) space — no external API needed for the core decision
        const triage = calculateRiskScore(latestVitals, allVitals);

        // ── Step 2: Gemini explains the result in plain English ───────────────
        // Algorithm owns the risk decision; Gemini only narrates it
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt =
            `A post-discharge patient diagnosed with "${patient.primaryDisease}" has been assessed ` +
            `by a custom clinical triage algorithm. Here are the results:\n\n` +
            `  Composite Risk Score : ${triage.score} / 1.0\n` +
            `  Risk Level           : ${triage.riskLevel}\n` +
            `  Data points analysed : ${triage.dataPoints} vitals readings\n\n` +
            `  Parameter danger scores (0 = safe, 100 = critical):\n` +
            `    Blood Pressure : ${triage.breakdown.bloodPressureDanger}%\n` +
            `    Heart Rate     : ${triage.breakdown.heartRateDanger}%\n` +
            `    Blood Sugar    : ${triage.breakdown.bloodSugarDanger}%\n` +
            `    Hemoglobin     : ${triage.breakdown.hemoglobinDanger}%\n` +
            `    Trend penalty  : ${triage.breakdown.trendPenalty}%\n\n` +
            `  Latest raw vitals: ${JSON.stringify(latestVitals)}\n\n` +
            `In exactly 2–3 clinical sentences, explain to the attending doctor ` +
            `WHY this patient received this risk score and what specific action to take. ` +
            `Be concise and medically specific. Do not repeat the numbers.`;

       let geminiExplanation = "AI narrative unavailable right now. Algorithm assessment is complete.";
try {
    const geminiResult = await model.generateContent(prompt);
    geminiExplanation = geminiResult.response.text();
} catch (geminiError) {
    console.warn("⚠ Gemini unavailable — returning algorithm result only");
}

res.status(200).json({
    analysis: `[RISK LEVEL: ${triage.riskLevel}] ${geminiExplanation}`,
            // Rich data for dashboard visualisation
            algorithmScore: triage.score,
            riskLevel:      triage.riskLevel,
            riskLabel:      triage.riskLabel,
            dataPoints:     triage.dataPoints,
            breakdown:      triage.breakdown,
        });

    } catch (error) {
        console.error("Triage Algorithm Error:", error);
        res.status(500).json({ analysis: "Error running triage algorithm. Please check server logs." });
    }
});


// ==========================================
// CATCH-ALL ROUTE
// ==========================================
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});


// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server is officially running on port ${PORT}`);
});

// Export server AND algorithm functions for testing
module.exports = server;
module.exports.normaliseVital     = normaliseVital;
module.exports.calculateTrend    = calculateTrend;
module.exports.calculateRiskScore = calculateRiskScore;

