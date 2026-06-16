const express = require('express');
const router = express.Router();
const User = require('../models/User'); 
const bcrypt = require('bcryptjs');

// ==========================================
// 1. SECURE REGISTRATION (With 6-Digit OTP)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, specialization } = req.body;

        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({ message: "❌ This email is already registered!" });
        }

        const newUser = new User({
            name,
            email,
            password: await bcrypt.hash(password, 10), 
            role,
            specialization: specialization || "Not Specified",
            patientId: role === 'patient' ? `PAT-${Math.floor(Math.random() * 10000)}` : null,
            doctorId: role === 'doctor' ? `DOC-${Math.floor(Math.random() * 10000)}` : null
        });

        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        newUser.otp = verificationCode.toString();
        newUser.otpExpires = new Date(Date.now() + 10 * 60 * 1000); 

        await newUser.save();

        // 🚨 SEND EMAIL VIA BREVO API (Bypasses Render Block & Sends to Anyone)
        const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: 'NextStep Care', email: 'yadavanirudha4169@gmail.com' }, // Must be your Brevo account email
                to: [{ email: email }], // Will successfully send to ANY email address!
                subject: 'NextStep Care - Your Verification Code',
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
                        <h2>Hello ${name},</h2>
                        <p>Your 6-digit verification code is: <strong style="font-size: 24px; color: #0ea5e9;">${verificationCode}</strong></p>
                        <p>Please enter this code on the screen to verify your account.</p>
                        <br/>
                        <p><strong>NextStep-Care</strong><br/>Smart Recovery. Stronger Tomorrow.</p>
                    </div>
                `
            })
        });

        if (!emailResponse.ok) {
            const errData = await emailResponse.json();
            console.error("Brevo API failed:", errData);
        } else {
            console.log("✅ Verification code sent via Brevo to:", email);
        }

        res.status(201).json({ message: "✅ Registration successful! Check your email." });

    } catch (err) {
        console.error("🚨 REGISTRATION CRASH DETAILS:", err.message);
        res.status(500).json({ message: "Server Error during registration." });
    }
});

// ==========================================
// 2. SECURE LOGIN
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const user = await User.findOne({ email: email, role: role });
       
        const isMatch = user && await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email, password, or role." });
        }

        if (!user.isVerified) {
            return res.status(401).json({ message: "❌ Please verify your email before logging in." });
        }

        res.status(200).json({
            message: "Login successful",
            name: user.name,
            email: user.email,
            role: user.role,
            patientId: user.patientId,
            doctorId: user.doctorId,
            _id: user._id
        });

    } catch (err) {
        res.status(500).json({ message: "Server Error during login." });
    }
});

// ==========================================
// 3. VERIFY OTP
// ==========================================
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(400).json({ message: "❌ User not found." });
        }

        // Allow the real OTP, OR the Master Hackathon OTP (123456)
        if (user.otp !== otp && otp !== "123456") {
            return res.status(400).json({ message: "❌ Incorrect OTP. Please try again." });
        }

        if (user.otpExpires < new Date()) {
            return res.status(400).json({ message: "❌ OTP has expired. Please register again." });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.status(200).json({ 
            success: true, 
            message: "✅ Email verified successfully!",
            id: user._id,
            patientId: user.patientId,
            doctorId: user.doctorId
        });

    } catch (err) {
        console.error("Verification Crash:", err);
        res.status(500).json({ message: "Server Error during verification." });
    }
});

module.exports = router;