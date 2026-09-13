const test = require('node:test');
const assert = require('node:assert');

test('Smoke Test 1: Environment Variables configuration check', () => {
    // Ensures the environment can be loaded and parsed
    assert.strictEqual(typeof process.env, 'object');
});

test('Smoke Test 2: Express app dependency check', () => {
    // Ensures the core backend framework is installed and importable
    const express = require('express');
    assert.strictEqual(typeof express, 'function');
});

test('Smoke Test 3: Database driver check', () => {
    // Ensures Mongoose is ready to handle MongoDB connections
    const mongoose = require('mongoose');
    assert.strictEqual(typeof mongoose.connect, 'function');
});