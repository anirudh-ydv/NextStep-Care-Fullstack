require('dotenv').config(); // Keeps your environment variables working!
const express = require('express');
const mongoose = require('mongoose'); 
const cors = require('cors');
const path = require('path'); // ADDED: Needed for finding your HTML files

// Import your route files
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');

const app = express();

// Middleware (Allows your frontend to talk to your backend)
app.use(cors());
app.use(express.json());

// ==========================================
// SERVE FRONTEND (Monorepo Setup)
// ==========================================
// This tells Node to serve the HTML, CSS, and JS files from this exact folder
app.use(express.static(__dirname)); 

// ==========================================
// 🚨 THE DATABASE ENGINE (Pointed to the FRESH database)
// ==========================================
// We use the hardcoded 'nextstep_clean' here temporarily just to force the wipe!
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to FRESH Database! (nextstep_clean)"))
    .catch(err => console.error("❌ Database Connection Failed:", err));

// ==========================================
// API ROUTES
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);

// ==========================================
// CATCH-ALL ROUTE
// ==========================================
// If someone types a random URL, send them back to the main website
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// START THE SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is officially running on port ${PORT}`);
});