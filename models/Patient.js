const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    patientId: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String }, 
    age: { type: Number },
    gender: { type: String },
    primaryDisease: { type: String },
    currentBP: { type: String, default: "120/80" },
    bloodSugar: { type: Number, default: 0 },
    hemoglobin: { type: Number, default: 0 },
    heartRate: { type: Number, default: 75 }, 
    nextAppointment: { type: String },
    healthStatus: { type: String, default: "stable" },
    assignedDoctorId: { type: String, required: true },
    
    // Dynamic Arrays for EHR
    medicines: [{ name: String, dosage: String, time: String }],
    symptoms: [{ type: String }], 
    chatHistory: [{ sender: String, message: String, time: String }], // 🚀 NEW CHAT SYSTEM
    
    nextTelemedSession: { date: String, time: String, link: String },
    notifications: [{ message: { type: String }, alertType: { type: String }, createdAt: { type: Date, default: Date.now } }],
    
    historicalVitals: [{
        date: { type: String },
        heartRate: Number,
        systolic: Number,
        diastolic: Number,
        sugar: Number,
        hemoglobin: Number
    }]
});

module.exports = mongoose.model('Patient', PatientSchema);