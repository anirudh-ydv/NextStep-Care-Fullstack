const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['doctor', 'patient'], required: true },
    specialization: { type: String }, // For doctors
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    doctorId: { type: String }, // Generated on verify
    patientId: { type: String } // Generated on verify or Doctor creation
});

module.exports = mongoose.model('User', UserSchema);