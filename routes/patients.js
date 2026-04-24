const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ==========================================
// 🚀 CORE DATABASE ROUTES
// ==========================================

// 1. Fetch ALL Patients
router.get('/doctor/:doctorId', async (req, res) => {
    try {
        const patients = await Patient.find({}); 
        res.json(patients);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2. Add New Patient (Saves the phone number for the mock text system)
router.post('/add', async (req, res) => {
    try {
        const { currentBP, bloodSugar, hemoglobin, heartRate, phone } = req.body;
        let sys = 120, dia = 80;
        if (currentBP && currentBP.includes('/')) [sys, dia] = currentBP.split('/');

        const todayDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const newPatient = new Patient({
            ...req.body,
            phone: phone, 
            historicalVitals: [{
                date: todayDate, heartRate: heartRate || 75, systolic: parseInt(sys) || 120,
                diastolic: parseInt(dia) || 80, sugar: bloodSugar || 0, hemoglobin: hemoglobin || 0
            }]
        });
        await newPatient.save();
        res.status(201).json({ message: "✅ Patient Saved!" });
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// 3. Fetch Single Patient Profile (With 24-Hour Notification Janitor)
router.get('/me/:email', async (req, res) => {
    try {
        const p = await Patient.findOne({ email: req.params.email });
        if (!p) return res.status(404).json({ message: "Not found" });

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const originalCount = p.notifications.length;
        
        // Clean up notifications older than 24 hours
        p.notifications = p.notifications.filter(n => new Date(n.createdAt) > twentyFourHoursAgo);

        if (p.notifications.length !== originalCount) await p.save();
        res.json(p);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 4. Update Patient Vitals & Chat
router.put('/update/:email', async (req, res) => {
    try {
        const { currentBP, bloodSugar, hemoglobin, heartRate, healthStatus, medicines, symptoms, chatHistory } = req.body;
        
        const patient = await Patient.findOne({ email: req.params.email });
        if(!patient) return res.status(404).json({ message: "Not found" });

        let updateData = {};
        if (healthStatus) updateData.healthStatus = healthStatus;
        if (medicines) updateData.medicines = medicines;
        if (symptoms) updateData.symptoms = symptoms;
        if (chatHistory) updateData.chatHistory = chatHistory;

        if (currentBP || bloodSugar || hemoglobin || heartRate) {
            let sys = 120, dia = 80;
            if (currentBP && currentBP.includes('/')) [sys, dia] = currentBP.split('/');
            
            updateData.currentBP = currentBP || patient.currentBP;
            updateData.bloodSugar = bloodSugar || patient.bloodSugar;
            updateData.hemoglobin = hemoglobin || patient.hemoglobin;
            updateData.heartRate = heartRate || patient.heartRate;

            const todayDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            let history = patient.historicalVitals || [];
            const lastEntryIndex = history.findIndex(v => v.date === todayDate);

            const newVitalEntry = {
                date: todayDate, heartRate: updateData.heartRate, systolic: parseInt(sys) || 120,
                diastolic: parseInt(dia) || 80, sugar: updateData.bloodSugar, hemoglobin: updateData.hemoglobin
            };

            if (lastEntryIndex >= 0) history[lastEntryIndex] = newVitalEntry; 
            else history.push(newVitalEntry); 

            if (history.length > 7) history.shift(); 
            updateData.historicalVitals = history;
        }

        const updatedPatient = await Patient.findOneAndUpdate({ email: req.params.email }, { $set: updateData }, { new: true });
        res.json({ message: "Profile Updated!", data: updatedPatient });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==========================================
// 🚀 SCHEDULING & MOCK NOTIFICATION ROUTES
// ==========================================

// 5. SCHEDULE TELEMED (Jitsi Video Room + In-App Bell + Mock WhatsApp)
router.post('/schedule-telemed', async (req, res) => {
    try {
        const { email, date, time } = req.body;
        const patient = await Patient.findOne({ email: email });
        
        // 🚀 STRICTLY JITSI LINK GENERATION
        const uniqueRoomName = 'NextStepCare-Room-' + Math.random().toString(36).substring(2, 10);
        const meetLink = `https://meet.jit.si/${uniqueRoomName}`;
        
        const notificationMessage = `Your Telemedicine Video Consultation is scheduled for ${date} at ${time}.\n\nClick here to join the secure room: ${meetLink}`;

        // Save to Database for the UI Bell Icon
        await Patient.findOneAndUpdate(
            { email: email },
            { 
                $set: { "nextTelemedSession": { date, time, link: meetLink } }, 
                $push: { notifications: { message: `🎥 NextStep Care:\n${notificationMessage}`, alertType: 'telemed' } } 
            }
        );

        // Print a Mock WhatsApp to the VS Code Terminal
        const targetPhone = patient && patient.phone ? patient.phone : "NO_PHONE_SAVED";
        console.log(`\n🟩 [SIMULATED WHATSAPP to ${targetPhone}] -> ${notificationMessage}\n`);

        res.json({ message: "Jitsi Video room generated!", meetLink });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 6. SCHEDULE PHYSICAL APPOINTMENT (In-App Bell + Mock SMS)
router.post('/schedule-appointment', async (req, res) => {
    try {
        const { email, date, time } = req.body;
        const patient = await Patient.findOne({ email: email });
        const notificationMessage = `Your Physical Appointment is Confirmed for ${date} at ${time}. Please arrive 10 minutes early.`;

        // Save to Database for the UI Bell Icon
        await Patient.findOneAndUpdate(
            { email: email },
            { $set: { nextAppointment: `${date}T${time}` }, $push: { notifications: { message: `🏥 ${notificationMessage}`, alertType: 'physical' } } }
        );

        // Print a Mock SMS to the VS Code Terminal
        const targetPhone = patient && patient.phone ? patient.phone : "NO_PHONE_SAVED";
        console.log(`\n💬 [SIMULATED SMS to ${targetPhone}] -> ${notificationMessage}\n`);

        res.json({ message: "Appointment confirmed." });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 7. Discharge Patient
router.delete('/remove/:dbId', async (req, res) => {
    try {
        await Patient.findByIdAndDelete(req.params.dbId);
        res.json({ message: "Patient discharged" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ==========================================
// 🚀 AI MEDICAL ASSISTANT CHATBOT
// ==========================================
router.post('/ai-chat', async (req, res) => {
    try {
        const { message, patientDisease } = req.body;
        
       // 🚨 NO QUOTES around process.env! 🚨
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", 
            systemInstruction: `You are a helpful, empathetic medical AI assistant for the healthcare platform 'NextStep Care'. The patient's primary condition is: ${patientDisease}. Provide safe lifestyle, diet, or general wellness advice based on their condition. Keep your answers short (under 3 sentences). CRITICAL RULE: Always remind the patient to consult their actual doctor for emergencies or changes in medication.`
        });

        const result = await model.generateContent(message);
        res.json({ reply: result.response.text() });
    } catch (err) {
        console.error("AI CRASH:", err);
        res.status(500).json({ reply: "🚨 SYSTEM ERROR: " + err.message });
    }
});

module.exports = router;