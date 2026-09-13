// tests/auth.test.js
// Tests: OTP, bcrypt, JWT, normaliseVital, calculateTrend, calculateRiskScore
// Run: npm test  (Node 18+ built-in runner, zero extra dependencies)

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

// Pull the three pure algorithm functions directly from server.js
// TEST_MODE prevents the DB connection from firing
process.env.TEST_MODE      = 'true';
process.env.GEMINI_API_KEY = 'test_placeholder';
process.env.JWT_SECRET     = 'test_secret';
process.env.EMAIL_USER     = 'test@test.com';
process.env.EMAIL_PASS     = 'testpass';
process.env.MONGO_URI      = 'mongodb://localhost/test';

const { normaliseVital, calculateTrend, calculateRiskScore } = require('../server');

// ── Helper ───────────────────────────────────────────────────────────────────
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ════════════════════════════════════════════════════════════════
//  OTP TESTS
// ════════════════════════════════════════════════════════════════
test('OTP — always produces a 6-digit string', () => {
    for (let i = 0; i < 20; i++) {
        const otp = generateOTP();
        assert.equal(typeof otp, 'string');
        assert.equal(otp.length, 6);
        assert.match(otp, /^\d{6}$/);
    }
});

test('OTP — values are not always identical (randomness)', () => {
    const otps = new Set(Array.from({ length: 10 }, generateOTP));
    assert.ok(otps.size > 1);
});

// ════════════════════════════════════════════════════════════════
//  BCRYPT TESTS
// ════════════════════════════════════════════════════════════════
test('bcrypt — hash differs from plaintext', async () => {
    const hash = await bcrypt.hash('TestPass@123', 10);
    assert.notEqual(hash, 'TestPass@123');
    assert.ok(hash.startsWith('$2'));
});

test('bcrypt — correct password verifies', async () => {
    const hash = await bcrypt.hash('TestPass@123', 10);
    assert.equal(await bcrypt.compare('TestPass@123', hash), true);
});

test('bcrypt — wrong password fails verification', async () => {
    const hash = await bcrypt.hash('TestPass@123', 10);
    assert.equal(await bcrypt.compare('WrongPass!', hash), false);
});

// ════════════════════════════════════════════════════════════════
//  JWT TESTS
// ════════════════════════════════════════════════════════════════
test('JWT — patient token encodes and decodes correctly', () => {
    const token   = jwt.sign({ userId: 'abc123', role: 'patient' }, 'test_secret', { expiresIn: '1h' });
    const decoded = jwt.verify(token, 'test_secret');
    assert.equal(decoded.userId, 'abc123');
    assert.equal(decoded.role,   'patient');
});

test('JWT — doctor role encodes correctly', () => {
    const token   = jwt.sign({ userId: 'doc456', role: 'doctor' }, 'test_secret');
    const decoded = jwt.verify(token, 'test_secret');
    assert.equal(decoded.role, 'doctor');
});

test('JWT — tampered token is rejected', () => {
    const token   = jwt.sign({ userId: 'abc123' }, 'test_secret');
    const tampered = token.slice(0, -5) + 'XXXXX';
    assert.throws(() => jwt.verify(tampered, 'test_secret'), /invalid/i);
});

// ════════════════════════════════════════════════════════════════
//  normaliseVital() — O(1) unit tests
// ════════════════════════════════════════════════════════════════
test('normaliseVital — value inside safe range returns 0.0', () => {
    // BP 120 is perfectly normal (safe range 90–130)
    const score = normaliseVital(120, 70, 90, 130, 180);
    assert.equal(score, 0.0);
});

test('normaliseVital — value above critHigh returns 1.0', () => {
    // BP 200 is way above critical (critHigh = 180)
    const score = normaliseVital(200, 70, 90, 130, 180);
    assert.equal(score, 1.0);
});

test('normaliseVital — value below critLow returns 1.0', () => {
    // BP 60 is below critical low (critLow = 70)
    const score = normaliseVital(60, 70, 90, 130, 180);
    assert.equal(score, 1.0);
});

test('normaliseVital — value in warning zone returns between 0 and 1', () => {
    // BP 155 is in high-side warning zone (130–180)
    const score = normaliseVital(155, 70, 90, 130, 180);
    assert.ok(score > 0 && score < 1, `Expected 0–1, got ${score}`);
});

test('normaliseVital — missing value returns 0.5 (neutral)', () => {
    assert.equal(normaliseVital(null,  70, 90, 130, 180), 0.5);
    assert.equal(normaliseVital(NaN,   70, 90, 130, 180), 0.5);
    assert.equal(normaliseVital(undefined, 70, 90, 130, 180), 0.5);
});

// ════════════════════════════════════════════════════════════════
//  calculateTrend() — O(n) unit tests
// ════════════════════════════════════════════════════════════════
test('calculateTrend — rising values return positive slope', () => {
    const vitals = [
        { systolic: 110 }, { systolic: 120 },
        { systolic: 130 }, { systolic: 140 }, { systolic: 155 },
    ];
    const slope = calculateTrend(vitals, 'systolic');
    assert.ok(slope > 0, `Expected positive slope, got ${slope}`);
});

test('calculateTrend — falling values return negative slope', () => {
    const vitals = [
        { heartRate: 120 }, { heartRate: 110 },
        { heartRate: 95 },  { heartRate: 80 }, { heartRate: 70 },
    ];
    const slope = calculateTrend(vitals, 'heartRate');
    assert.ok(slope < 0, `Expected negative slope, got ${slope}`);
});

test('calculateTrend — flat values return slope near zero', () => {
    const vitals = [
        { sugar: 100 }, { sugar: 100 },
        { sugar: 100 }, { sugar: 100 },
    ];
    const slope = calculateTrend(vitals, 'sugar');
    assert.ok(Math.abs(slope) < 0.01, `Expected ~0, got ${slope}`);
});

test('calculateTrend — single entry returns 0 (no trend possible)', () => {
    assert.equal(calculateTrend([{ systolic: 130 }], 'systolic'), 0);
});

// ════════════════════════════════════════════════════════════════
//  calculateRiskScore() — master algorithm integration tests
// ════════════════════════════════════════════════════════════════
test('calculateRiskScore — perfect vitals score LOW risk', () => {
    const vitals = Array.from({ length: 5 }, () => ({
        systolic: 115, heartRate: 75, sugar: 100, hemoglobin: 14,
    }));
    const result = calculateRiskScore(vitals[4], vitals);
    assert.equal(result.riskLevel, 'LOW');
    assert.ok(result.score < 0.35, `Expected score < 0.35, got ${result.score}`);
});

test('calculateRiskScore — dangerously high BP scores HIGH risk', () => {
    const vitals = Array.from({ length: 5 }, () => ({
        systolic: 195, heartRate: 155, sugar: 290, hemoglobin: 5,
    }));
    const result = calculateRiskScore(vitals[4], vitals);
    assert.equal(result.riskLevel, 'HIGH');
    assert.ok(result.score >= 0.65, `Expected score ≥ 0.65, got ${result.score}`);
});

test('calculateRiskScore — two abnormal vitals scores MEDIUM risk', () => {
    const vitals = Array.from({ length: 5 }, () => ({
        systolic: 165, heartRate: 130, sugar: 220, hemoglobin: 9,
    }));
    const result = calculateRiskScore(vitals[4], vitals);
    assert.ok(
        result.riskLevel === 'MEDIUM' || result.riskLevel === 'HIGH',
        `Expected MEDIUM or HIGH, got ${result.riskLevel}`
    );
});

test('calculateRiskScore — rising BP trend increases score vs flat', () => {
    const flatVitals   = Array.from({ length: 7 }, () => ({ systolic: 125, heartRate: 75, sugar: 100, hemoglobin: 14 }));
    const risingVitals = [110,115,120,125,130,140,155].map(bp => ({ systolic: bp, heartRate: 75, sugar: 100, hemoglobin: 14 }));

    const flatResult   = calculateRiskScore(flatVitals[6],   flatVitals);
    const risingResult = calculateRiskScore(risingVitals[6], risingVitals);

    assert.ok(
        risingResult.score >= flatResult.score,
        `Rising trend (${risingResult.score}) should score ≥ flat (${flatResult.score})`
    );
});

test('calculateRiskScore — breakdown percentages are all 0–100', () => {
    const vitals = Array.from({ length: 3 }, () => ({
        systolic: 120, heartRate: 80, sugar: 110, hemoglobin: 13,
    }));
    const { breakdown } = calculateRiskScore(vitals[2], vitals);
    for (const [key, val] of Object.entries(breakdown)) {
        assert.ok(val >= 0 && val <= 100, `${key} = ${val} is out of 0–100 range`);
    }
});

test('calculateRiskScore — dataPoints matches vitals array length', () => {
    const vitals = Array.from({ length: 8 }, () => ({
        systolic: 115, heartRate: 72, sugar: 95, hemoglobin: 14,
    }));
    const result = calculateRiskScore(vitals[7], vitals);
    assert.equal(result.dataPoints, 8);
});