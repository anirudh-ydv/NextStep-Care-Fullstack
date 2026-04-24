// ==========================================
// 1. CONFIGURATION & SECURE AUTH LOGIC
// ==========================================
const API_URL = 'http://localhost:5000/api/auth';

// SECURE LOGIN
async function handleLogin(e) {
    if(e) e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('userType').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });
        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            window.location.href = data.user.role === 'doctor' ? 'doctor-dashboard.html' : 'patient-dashboard.html';
        } else {
            alert(data.message || "Invalid credentials!");
        }
    } catch (err) {
        alert("Login failed. Is your backend server running on port 5000?");
    }
}

// SECURE REGISTRATION
async function handleRegister(e) {
    if(e) e.preventDefault();
    const userData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        role: document.getElementById('userType').value,
        specialization: document.getElementById('specialization')?.value || ""
    };

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        if (response.status === 201) {
            localStorage.setItem('emailToVerify', userData.email);
            alert("Success! Check your Gmail for the 6-digit verification code.");
            window.location.href = 'verify.html';
        } else {
            const data = await response.json();
            alert(data.message);
        }
    } catch (err) {
        alert("Server Error. Check your connection.");
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token'); 
    window.location.href = 'login.html';
}

// ==========================================
// 2. SECURITY BOUNCER (Auth Guard)
// ==========================================
function checkAuth(requiredRole) {
    const token = localStorage.getItem('token');
    const userString = localStorage.getItem('currentUser');

    if (!token || !userString) {
        alert("🔒 Access Denied: Please log in first.");
        window.location.href = 'login.html';
        return false;
    }

    const user = JSON.parse(userString);
    if (requiredRole && user.role !== requiredRole) {
        alert("⛔ Access Denied: You do not have permission to view this page.");
        if (user.role === 'doctor') window.location.href = 'doctor-dashboard.html';
        if (user.role === 'patient') window.location.href = 'patient-dashboard.html';
        return false;
    }

    return true; 
}

// ==========================================
// 3. CORE SYSTEM SWITCHBOARD
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    // 1. Auth Pages
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);

    // 2. Patient Dashboard
    if (window.location.pathname.includes('patient-dashboard.html')) {
        if (checkAuth('patient')) {
            setupPatientDashboard();
            const healthForm = document.getElementById('healthUpdateForm');
            if(healthForm) healthForm.addEventListener('submit', handleHealthUpdate);
        }
    }

    // 3. Doctor Dashboard
    if (window.location.pathname.includes('doctor-dashboard.html')) {
        if (checkAuth('doctor')) {
            initDoctorDashboard();
            setupNavigation();
        }
    }
    
    // 4. Add Patient Page
    if (window.location.pathname.includes('add-patient.html')) {
        if (checkAuth('doctor')) {
            initDoctorDashboard(); // Sets the Doctor's name in the corner
            
            // Note: handleAddPatient is now triggered directly by the button onclick in HTML
            
            // Wire up the Add Medicine Button
            const addMedBtn = document.getElementById('addMedicineBtn');
            if (addMedBtn) {
                addMedBtn.addEventListener('click', addMedicineRow);
            }
        }
    }
    
    // 5. Patient Profile Page
    if (window.location.pathname.includes('patient-profile.html')) {
        if (checkAuth('doctor')) {
            initPatientProfile();
        }
    }
});

// ==========================================
// 4. UI & DASHBOARD LOGIC 
// ==========================================
function setupNavigation() {
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.addEventListener('click', function(e) {
            if(this.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                document.querySelector('.sidebar a.active')?.classList.remove('active');
                this.classList.add('active');
                
                document.querySelectorAll('.content-section').forEach(section => {
                    section.style.display = 'none';
                });
                
                const target = this.getAttribute('href');
                const section = document.querySelector(target);
                if (section) section.style.display = 'block';
            }
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.secondary-nav a').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).style.display = 'block';
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
}

function triggerEmergency() {
    const confirmSOS = confirm("🚨 URGENT: Do you need to call an ambulance and alert your doctor immediately?");
    if(confirmSOS) {
        alert("Ambulance dispatched. Doctor has been notified via priority alert.");
    }
}

// ==========================================
// 5. DATA SAVING LOGIC (Adding Patients)
// ==========================================
function addMedicineRow() {
    const container = document.getElementById('medicinesContainer');
    if (!container) return; 
    
    const newEntry = document.createElement('div');
    newEntry.className = 'medicine-entry';
    newEntry.style.display = 'flex';
    newEntry.style.gap = '10px';
    newEntry.style.marginBottom = '15px';
    
    newEntry.innerHTML = `
        <input type="text" class="medicine-name" placeholder="Medicine Name" style="flex: 2; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
        <input type="text" class="medicine-dosage" placeholder="Dosage (e.g. 500mg)" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
        <input type="time" class="medicine-time" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
        <button type="button" onclick="this.parentElement.remove()" style="background: #e11d48; color: white; border: none; padding: 10px 15px; border-radius: 8px; cursor: pointer;">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    container.appendChild(newEntry);
}

// MASTER SAVE FUNCTION
async function handleAddPatient(e) {
    // Prevent page reload if triggered by a form submit
    if (e) e.preventDefault(); 

    const currentUserString = localStorage.getItem('currentUser');
    if (!currentUserString) {
        alert("Error: You are not logged in properly. Please log in again.");
        window.location.href = 'login.html';
        return;
    }

    const currentUser = JSON.parse(currentUserString);

    // SAFETY CHECK: Warns if the doctor account is broken/missing an ID
    if (!currentUser.assignedId) {
        alert("Account Error: Your doctor account is missing an ID. Please register a brand new doctor account to save patients.");
        return;
    }
    
    // Gather all the data from the form
    const patientData = {
        name: document.getElementById('patientName')?.value || "Unknown",
        patientId: document.getElementById('patientId')?.value || "",
        email: document.getElementById('patientEmail')?.value || "", // The Patient Login Email
        age: document.getElementById('age')?.value || 0,
        gender: document.getElementById('gender')?.value || "",
        primaryDisease: document.getElementById('primaryDisease')?.value || "",
        currentBP: document.getElementById('currentBP')?.value || "",
        bloodSugar: document.getElementById('bloodSugar')?.value || "",
        hemoglobin: document.getElementById('hemoglobin')?.value || "",
        nextAppointment: document.getElementById('nextAppointment')?.value || "",
        healthStatus: document.getElementById('healthStatus')?.value || "Stable",
        doctorId: currentUser.assignedId // Link to the Doctor!
    };

    // Gather all the dynamic medicine rows
    const medEntries = document.querySelectorAll('.medicine-entry');
    patientData.medicines = Array.from(medEntries).map(entry => ({
        name: entry.querySelector('.medicine-name')?.value || "",
        dosage: entry.querySelector('.medicine-dosage')?.value || "",
        time: entry.querySelector('.medicine-time')?.value || "",
        taken: false
    }));

    // Send the package to the Backend
    try {
        const response = await fetch('https://nextstep-care.onrender.com/api/patients/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patientData)
        });

        if (response.ok) {
            alert("✅ SUCCESS! Medical record secured AND Patient Login Account created!");
            window.location.href = 'doctor-dashboard.html'; 
        } else {
            const errData = await response.json();
            alert("❌ Failed to save patient. Error: " + (errData.message || "Check terminal"));
        }
    } catch (err) {
        alert("❌ Failed to connect to backend. Is your server (node server.js) running?");
    }
}

// ==========================================
// 6. CHART ENGINE 
// ==========================================
function renderSplitCharts(patient, context = 'patient') {
    if(!patient || !patient.historicalVitals) return;
    const dates = patient.historicalVitals.map(v => v.date);
    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { border: { display: false } } } };

    const ctxHR = document.getElementById('chartHR');
    if (ctxHR) {
        if(window['chartHRInstance']) window['chartHRInstance'].destroy();
        window['chartHRInstance'] = new Chart(ctxHR, {
            type: 'line',
            data: { labels: dates, datasets: [{ data: patient.historicalVitals.map(v => v.hr || 75), borderColor: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.1)', fill: true, tension: 0.4 }] },
            options: chartOptions
        });
    }

    const ctxBP = document.getElementById('chartBP');
    if (ctxBP) {
        if(window['chartBPInstance']) window['chartBPInstance'].destroy();
        window['chartBPInstance'] = new Chart(ctxBP, {
            type: 'line',
            data: { labels: dates, datasets: [
                { data: patient.historicalVitals.map(v => v.systolic), borderColor: '#e11d48', tension: 0.4 },
                { data: patient.historicalVitals.map(v => v.diastolic), borderColor: '#d97706', borderDash: [5,5], tension: 0.4 }
            ]},
            options: chartOptions
        });
    }

    const ctxSugar = document.getElementById('chartSugar');
    if (ctxSugar) {
        if(window['chartSugarInstance']) window['chartSugarInstance'].destroy();
        window['chartSugarInstance'] = new Chart(ctxSugar, {
            type: 'line',
            data: { labels: dates, datasets: [{ data: patient.historicalVitals.map(v => v.sugar), borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', fill: true, tension: 0.4 }] },
            options: chartOptions
        });
    }
}

// UI Placeholders
function initDoctorDashboard() { 
    // This dynamically inserts the name of whoever is logged in!
    const userString = localStorage.getItem('currentUser');
    if(userString) {
        const user = JSON.parse(userString);
        const nameElement = document.getElementById('doctorName');
        if (nameElement) {
            nameElement.innerText = `Dr. ${user.name}`;
        }
    }
}
function initPatientProfile() { console.log("Profile Loaded."); }
function setupPatientDashboard() { console.log("Patient UI Loaded."); }
async function handleHealthUpdate(e) { e.preventDefault(); alert("Update feature coming soon!"); }