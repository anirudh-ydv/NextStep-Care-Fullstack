const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['doctor', 'patient'], required: true },
    specialization: { type: String }, 
    isVerified: { type: Boolean, default: true }, // ✅ Automatically verified
    otp: { type: String },
    otpExpires: { type: Date },
    doctorId: { type: String }, 
    patientId: { type: String } 
});

module.exports = mongoose.model('User', UserSchema);