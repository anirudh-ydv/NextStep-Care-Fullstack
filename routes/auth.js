const express = require('express');
const router = express.Router();
const User = require('../models/User'); 
const nodemailer = require('nodemailer'); 
const bcrypt = require('bcryptjs');

// ==========================================
// EMAIL ENGINE SETUP (The Postman)
// ==========================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, 
    family: 4, // 🚨 THE MAGIC FIX: Forces IPv4 and completely bypasses the broken Render network
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

// ==========================================
// 1. SECURE REGISTRATION (With 6-Digit OTP)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, specialization } = req.body;

        // 🚨 SECURITY CHECK: 1 Email = 1 Account
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({ message: "❌ This email is already registered!" });
        }

        // Create the new user
        const newUser = new User({
            name,
            email,
            password: await bcrypt.hash(password, 10), 
            role,
            specialization: specialization || "Not Specified",
            patientId: role === 'patient' ? `PAT-${Math.floor(Math.random() * 10000)}` : null,
            doctorId: role === 'doctor' ? `DOC-${Math.floor(Math.random() * 10000)}` : null
        });

       // 🚨 GENERATE A 6-DIGIT CODE
        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        newUser.otp = verificationCode.toString();
        newUser.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // expires in 10 mins

        await newUser.save();

        // 🚨 SEND THE OTP EMAIL
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'NextStep Care - Your Verification Code',
            text: `Hello ${name},\n\nYour 6-digit verification code is: ${verificationCode}\n\nPlease enter this code on the screen to verify your account.\n\nNextStep-Care\nSmart Recovery. Stronger Tomorrow.`
        };

        // Tell the postman to deliver it
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Email failed to send:", error);
            } else {
                console.log("✅ Verification code sent to:", email);
            }
        });

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

        // OTP is correct — mark verified and clear OTP
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