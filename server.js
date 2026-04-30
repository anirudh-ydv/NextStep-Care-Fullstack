require('dotenv').config(); // Keeps your environment variables working!
const express = require('express');
const mongoose = require('mongoose'); 
const cors = require('cors');
const path = require('path'); // Needed for finding your HTML files

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
// Tell Express to look inside the 'frontend' folder for HTML/CSS/JS
app.use(express.static(path.join(__dirname, 'frontend'))); 

// ==========================================
// 🚨 THE DATABASE ENGINE 
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to the Database!"))
    .catch(err => console.error("❌ Database Connection Failed:", err));

// ==========================================
// API ROUTES
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);

// ==========================================
// CATCH-ALL ROUTE (Express 5 Compatible Fix)
// ==========================================
// If someone types a random URL, send them back to the main website inside the frontend folder
// (Using app.use without a path bypasses the strict Express 5 wildcard rules)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ==========================================
// START THE SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is officially running on port ${PORT}`);
});