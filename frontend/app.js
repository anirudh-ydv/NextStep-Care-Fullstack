console.log("NextStep-Care frontend script loaded successfully.");

// Run this code only after the HTML has fully loaded
document.addEventListener('DOMContentLoaded', () => {
    
    // --- LOGIN PAGE LOGIC ---
    const loginForm = document.getElementById('loginForm');
    
    // Check if we are actually on the login page before running this
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 

            // 1. Grab Email, Password, AND Role!
            const emailInput = document.getElementById('email').value;
            const passwordInput = document.getElementById('password').value;
            const roleInput = document.getElementById('userType').value;

            try {
                // 2. Send all three to the backend
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email: emailInput, 
                        password: passwordInput,
                        role: roleInput 
                    })
                });

                const data = await response.json();

                if (response.ok && data.isVerified !== false) {
                    // ✅ SUCCESS! 
                    
                    // 3. Save the details to memory
                    const userObj = {
                        name: data.name || data.user?.name || "User",
                        role: data.role || roleInput,
                        assignedId: data.patientId || data.doctorId || data.user?.id || data._id,
                        email: emailInput 
                    };

                    localStorage.setItem('currentUser', JSON.stringify(userObj));

                    // 4. Redirect based on the dropdown choice
                    if (userObj.role === 'patient') {
                        window.location.href = 'patient-dashboard.html';
                    } else {
                        window.location.href = 'doctor-dashboard.html';
                    }

                } else {
                    // ❌ FAILED 
                    alert("❌ Login Failed: " + (data.message || "Invalid credentials. If you just registered, please verify your email first."));
                }

            } catch (error) {
                console.error("Login Crash:", error);
                alert("🚨 Request Failed! Make sure node server.js is running.");
            }
        });
    }

});

// --- REGISTRATION PAGE UI & SUBMISSION LOGIC ---

// Logic to hide Specialization if Patient is selected
function toggleSpecialization() {
    const roleDropdown = document.getElementById('userType');
    const specGroup = document.getElementById('specGroup');
    
    // Only run this if we are actually on the Register page
    if (roleDropdown && specGroup) {
        specGroup.style.display = (roleDropdown.value === 'doctor') ? 'block' : 'none';
    }
}

// Run once when page loads to set initial state
document.addEventListener('DOMContentLoaded', toggleSpecialization);

// Registration Submission Logic
window.handleRegister = async function(e) {
    if (e) e.preventDefault(); // Stop page reload

    // Grab the inputs
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const roleInput = document.getElementById('userType');
    const specInput = document.getElementById('specialization');

    // Create the data object to send to the backend
    const userData = {
        name: nameInput.value,
        email: emailInput.value,
        role: roleInput.value,
        password: passInput.value,
        specialization: specInput ? specInput.value : ""
    };

    // Change button text so you know it's loading
    const registerBtn = document.querySelector('button[type="submit"]');
    const originalText = registerBtn.innerHTML;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending OTP...';
    registerBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const data = await response.json(); 

        if (response.ok) {
            // ✅ Success! Save email to memory and go to verify page
            localStorage.setItem('emailToVerify', userData.email);
            window.location.href = 'verify.html';
        } else {
            // ❌ Backend rejected it (e.g. Email already used)
            alert("⚠️ Registration Failed: " + (data.message || "Unknown error"));
        }
    } catch (err) {
        // 🚨 Server crash or not running
        console.error("Registration fetch error:", err);
        alert("🚨 Server error! Make sure your Node.js backend is running and connected to MongoDB.");
    } finally {
        // Reset button
        registerBtn.innerHTML = originalText;
        registerBtn.disabled = false;
    }
};

// Run once when page loads to set initial state
document.addEventListener('DOMContentLoaded', toggleSpecialization);

// --- PATIENT DASHBOARD LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    // Only run this script if we are on the Patient Dashboard page
    if (document.getElementById('view-overview')) {

        let patientData = null;
        let currentLang = 'en'; 

        // Make these functions globally accessible so HTML onclick handlers can find them
        window.applyLanguage = function() { document.querySelectorAll('.lang-text').forEach(el => { el.innerText = el.getAttribute(`data-${currentLang}`); }); }
        window.toggleLanguage = function() { currentLang = currentLang === 'en' ? 'hi' : 'en'; document.getElementById('langIndicator').innerText = currentLang === 'en' ? 'हिंदी' : 'English'; applyLanguage(); renderCarePlans(); }
        window.switchTab = function(tabId) { document.querySelectorAll('.section-view, .sidebar-item').forEach(el => { el.classList.remove('active'); }); document.getElementById('view-' + tabId).classList.add('active'); document.getElementById('tab-' + tabId).classList.add('active'); if(tabId === 'history') renderPatientCharts(); }
        
        window.toggleAIChat = function() {
            const chatWin = document.getElementById('floatingAIChat');
            chatWin.style.display = chatWin.style.display === 'flex' ? 'none' : 'flex';
        }

        async function init() {
            const user = JSON.parse(localStorage.getItem('currentUser'));
            if(!user) return window.location.href = 'login.html';
            const res = await fetch(`/api/patients/me/${user.email}`);
            patientData = await res.json();

            document.getElementById('welcomeName').innerText = patientData.name;
            document.getElementById('vHR').innerHTML = `${patientData.heartRate || '--'} <span style="font-size:1rem; color:#94a3b8;">bpm</span>`;
            document.getElementById('vBP').innerText = patientData.currentBP || '--';
            document.getElementById('vSugar').innerHTML = `${patientData.bloodSugar || '--'} <span style="font-size:1rem; color:#94a3b8;">mg/dL</span>`;
            document.getElementById('vHemo').innerHTML = `${patientData.hemoglobin || '--'} <span style="font-size:1rem; color:#94a3b8;">g/dL</span>`;

            document.getElementById('profName').innerText = patientData.name;
            document.getElementById('profId').innerText = `ID: ${patientData.patientId}`;
            document.getElementById('profEmail').innerText = patientData.email;
            document.getElementById('profAge').innerText = patientData.age || 'N/A';
            document.getElementById('profDisease').innerText = patientData.primaryDisease || 'N/A';

            if(patientData.nextAppointment) {
                const date = new Date(patientData.nextAppointment);
                document.getElementById('vAppt').innerHTML = date < new Date() ? `<span class="lang-text" data-en="Passed / Attended" data-hi="समय बीत गया">Passed / Attended</span>` : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
            } else { document.getElementById('vAppt').innerHTML = `<span class="lang-text" data-en="No upcoming appointments." data-hi="कोई आगामी नियुक्ति नहीं है।">No upcoming appointments.</span>`; }

            const notifs = patientData.notifications || [];
            document.getElementById('notifBadge').innerText = notifs.length;
            const notifContainer = document.getElementById('notifListContainer');
            
            if(notifs.length === 0) { 
                notifContainer.innerHTML = '<p style="text-align:center; color:#94a3b8;" class="lang-text" data-en="No new notifications." data-hi="कोई नई सूचना नहीं है।">No new notifications.</p>';
            } else { 
                notifContainer.innerHTML = [...notifs].reverse().map(n => { 
                    let clickableMsg = n.message.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: #0ea5e9; font-weight: bold; text-decoration: underline;">$1</a>');
                    return `<div class="notif-item"><div class="notif-icon"><i class="fas ${n.alertType === 'telemed' ? 'fa-video' : 'fa-calendar-alt'}"></i></div><div><p style="margin:0; font-size:0.9rem; color:#1e293b; white-space: pre-wrap;">${clickableMsg}</p><small style="color:#94a3b8;">${new Date(n.createdAt).toLocaleDateString()}</small></div></div>`; 
                }).join(''); 
            }

            const meds = patientData.medicines || [];
            const now = new Date();
            const currentTotalMins = (now.getHours() * 60) + now.getMinutes();

            document.getElementById('medicationListFull').innerHTML = meds.map((m, index) => {
                const isTaken = localStorage.getItem(`taken_${patientData.email}_${m.name}_${now.toLocaleDateString()}`);
                
                let btnHtml = '';
                if(m.time) {
                    const [medHours, medMinutes] = m.time.split(':').map(Number);
                    const diff = currentTotalMins - ((medHours * 60) + medMinutes);
                    
                    if (isTaken) {
                        btnHtml = `<button class="btn-take-med" style="background:#10b981;" disabled><i class="fas fa-check"></i> <span class="lang-text" data-en="Taken" data-hi="लिया गया">Taken</span></button>`;
                    } else if (diff > 30) {
                        btnHtml = `<button class="btn-missed" disabled><i class="fas fa-times-circle"></i> <span class="lang-text" data-en="Missed" data-hi="छूट गया">Missed</span></button>`;
                    } else {
                        btnHtml = `<button id="btn-med-${index}" class="btn-take-med" onclick="verifyMedicineTime('${m.name}', '${m.time}', ${index})"><i class="fas fa-check-circle"></i> <span class="lang-text" data-en="Mark Taken" data-hi="लिया गया">Mark Taken</span></button>`;
                    }
                }

                return `<div class="med-item" style="border-left-color: #d97706;"><div><strong style="color: #1e3c72; font-size:1.1rem;">${m.name}</strong><br><small style="color:#64748b; font-weight:bold;"><span class="lang-text" data-en="Take" data-hi="लें">Take</span> ${m.dosage}</small></div><div style="display:flex; align-items:center; gap:15px;"><span style="color:#d97706; font-weight:bold;"><i class="far fa-clock"></i> <span class="lang-text" data-en="Scheduled:" data-hi="निर्धारित:">Scheduled:</span> ${m.time}</span>${btnHtml}</div></div>`;
            }).join('');

            checkMedicines(meds);
            renderCarePlans();
            applyLanguage();
        }

        window.renderCarePlans = function() {
            const disease = (patientData.primaryDisease || "").toLowerCase();
            let diet = { en: "", hi: "" };
            let exercise = { en: "", hi: "" };

            if(disease.includes("diabet") || disease.includes("sugar")) {
                diet.en = `<span class="meal-time"><i class="fas fa-sun"></i> Morning</span><ul><li>Empty stomach: Water of soaked fenugreek (methi) seeds.</li><li>Breakfast: Oats, Dalia, or 2 boiled egg whites.</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> Afternoon</span><ul><li>Lunch: 2 Multigrain rotis, 1 bowl green vegetables, dal, and fresh salad.</li></ul><span class="meal-time"><i class="fas fa-moon"></i> Night</span><ul><li>Dinner: Light soup, grilled paneer or chicken. Eat at least 2 hours before sleeping.</li></ul>`;
                diet.hi = `<span class="meal-time"><i class="fas fa-sun"></i> सुबह</span><ul><li>खाली पेट: भीगे हुए मेथी दाने का पानी।</li><li>नाश्ता: ओट्स, दलिया, या 2 उबले अंडे का सफेद भाग।</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> दोपहर</span><ul><li>दोपहर का भोजन: 2 मल्टीग्रेन रोटी, 1 कटोरी हरी सब्जी, दाल और ताजा सलाद।</li></ul><span class="meal-time"><i class="fas fa-moon"></i> रात</span><ul><li>रात का खाना: हल्का सूप, ग्रिल्ड पनीर या चिकन। सोने से कम से कम 2 घंटे पहले खाएं।</li></ul>`;
                exercise.en = `<ul><li><strong>Cardio:</strong> 30 minutes of brisk walking daily.</li><li><strong>Yoga:</strong> Mandukasana (Frog Pose) and Kapalbhati Pranayama are highly effective for managing blood sugar levels.</li><li><strong>Avoid:</strong> Sitting for prolonged periods after meals.</li></ul>`;
                exercise.hi = `<ul><li><strong>कार्डियो:</strong> रोजाना 30 मिनट की तेज सैर।</li><li><strong>योग:</strong> रक्त शर्करा को प्रबंधित करने के लिए मंडूकासन (मेंढक मुद्रा) और कपालभाति प्राणायाम अत्यधिक प्रभावी हैं।</li><li><strong>बचें:</strong> भोजन के बाद लंबे समय तक बैठने से बचें।</li></ul>`;
            } else if(disease.includes("hyperten") || disease.includes("blood pressure") || disease.includes("bp") || disease.includes("heart")) {
                diet.en = `<span class="meal-time"><i class="fas fa-sun"></i> Morning</span><ul><li>Empty stomach: Warm water with lemon.</li><li>Breakfast: Oatmeal with potassium-rich fruits like bananas or berries. Green tea.</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> Afternoon</span><ul><li>Lunch: Brown rice, Dal, Curd. <strong>Strictly reduce salt (sodium) intake.</strong></li></ul><span class="meal-time"><i class="fas fa-moon"></i> Night</span><ul><li>Dinner: Boiled vegetables, light khichdi. Avoid oily and junk food entirely.</li></ul>`;
                diet.hi = `<span class="meal-time"><i class="fas fa-sun"></i> सुबह</span><ul><li>खाली पेट: नींबू के साथ गर्म पानी।</li><li>नाश्ता: केले या बेरी जैसे पोटेशियम युक्त फलों के साथ ओटमील। ग्रीन टी।</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> दोपहर</span><ul><li>दोपहर का भोजन: ब्राउन राइस, दाल, दही। <strong>नमक का सेवन सख्त कम करें।</strong></li></ul><span class="meal-time"><i class="fas fa-moon"></i> रात</span><ul><li>रात का खाना: उबली सब्जियां, हल्की खिचड़ी। तैलीय और जंक फूड से पूरी तरह बचें।</li></ul>`;
                exercise.en = `<ul><li><strong>Cardio:</strong> Moderate aerobic exercises like light jogging, swimming, or cycling (20-30 mins).</li><li><strong>Yoga:</strong> Practice Anulom Vilom and Shavasana for stress relief and lowering heart rate.</li><li><strong>Avoid:</strong> Heavy weightlifting or extreme high-intensity interval training (HIIT).</li></ul>`;
                exercise.hi = `<ul><li><strong>कार्डियो:</strong> हल्की जॉगिंग, तैराकी या साइकिल चलाने जैसे एरोबिक व्यायाम (20-30 मिनट)।</li><li><strong>योग:</strong> तनाव से राहत और हृदय गति को कम करने के लिए अनुलोम विलोम और शवासन का अभ्यास करें।</li><li><strong>बचें:</strong> भारी वजन उठाने या अत्यधिक उच्च तीव्रता वाले प्रशिक्षण से बचें।</li></ul>`;
            } else if(disease.includes("asthma") || disease.includes("copd") || disease.includes("lung")) {
                diet.en = `<span class="meal-time"><i class="fas fa-sun"></i> Morning</span><ul><li>Empty stomach: Warm water with ginger and honey.</li><li>Breakfast: Warm Poha or Upma.</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> Afternoon</span><ul><li>Lunch: Warm meals only. Include garlic and turmeric-rich dal.</li></ul><span class="meal-time"><i class="fas fa-moon"></i> Night</span><ul><li>Dinner: Turmeric milk (Haldi doodh), light vegetable stew. Avoid cold foods/drinks.</li></ul>`;
                diet.hi = `<span class="meal-time"><i class="fas fa-sun"></i> सुबह</span><ul><li>खाली पेट: अदरक और शहद के साथ गर्म पानी।</li><li>नाश्ता: गर्म पोहा या उपमा।</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> दोपहर</span><ul><li>दोपहर का भोजन: केवल गर्म भोजन। लहसुन और हल्दी युक्त दाल शामिल करें।</li></ul><span class="meal-time"><i class="fas fa-moon"></i> रात</span><ul><li>रात का खाना: हल्दी वाला दूध, सब्जियों का स्टू। ठंडे खाद्य/पेय पदार्थों से बचें।</li></ul>`;
                exercise.en = `<ul><li><strong>Cardio:</strong> Light indoor walking. Avoid exercising in cold, dry air or high pollution.</li><li><strong>Yoga:</strong> Bhastrika Pranayama (gentle) and Sukhasana to improve lung capacity.</li></ul>`;
                exercise.hi = `<ul><li><strong>कार्डियो:</strong> घर के अंदर हल्की सैर। ठंडी, शुष्क हवा या उच्च प्रदूषण में व्यायाम करने से बचें।</li><li><strong>योग:</strong> फेफड़ों की क्षमता में सुधार के लिए भस्त्रिका प्राणायाम (हल्का) और सुखासन।</li></ul>`;
            } else if(disease.includes("arthrit") || disease.includes("joint") || disease.includes("bone")) {
                diet.en = `<span class="meal-time"><i class="fas fa-sun"></i> Morning</span><ul><li>Breakfast: Papaya, walnuts, and flaxseeds (rich in Omega-3).</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> Afternoon</span><ul><li>Lunch: Include broccoli, garlic, and ginger in your meals to reduce inflammation.</li></ul><span class="meal-time"><i class="fas fa-moon"></i> Night</span><ul><li>Dinner: Spinach soup, light roti. Avoid processed sugars which trigger joint pain.</li></ul>`;
                diet.hi = `<span class="meal-time"><i class="fas fa-sun"></i> सुबह</span><ul><li>नाश्ता: पपीता, अखरोट, और अलसी (ओमेगा -3 से भरपूर)।</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> दोपहर</span><ul><li>दोपहर का भोजन: सूजन को कम करने के लिए अपने भोजन में ब्रोकोली, लहसुन और अदरक शामिल करें।</li></ul><span class="meal-time"><i class="fas fa-moon"></i> रात</span><ul><li>रात का खाना: पालक का सूप, हल्की रोटी। प्रसंस्कृत शर्करा से बचें जो जोड़ों के दर्द को बढ़ाते हैं।</li></ul>`;
                exercise.en = `<ul><li><strong>Physical Activity:</strong> Aqua therapy (water aerobics) or gentle stationary cycling.</li><li><strong>Yoga:</strong> Gentle joint rotations, Trikonasana (Triangle Pose).</li><li><strong>Avoid:</strong> High-impact exercises like running or jumping.</li></ul>`;
                exercise.hi = `<ul><li><strong>श शारीरिक गतिविधि:</strong> एक्वा थेरेपी (वाटर एरोबिक्स) या हल्की स्थिर साइकिल चलाना।</li><li><strong>योग:</strong> जोड़ों का हल्का घुमाव, त्रिकोणासन।</li><li><strong>बचें:</strong> दौड़ने या कूदने जैसे उच्च-प्रभाव वाले व्यायाम।</li></ul>`;
            } else if(disease.includes("thyroid")) {
                diet.en = `<span class="meal-time"><i class="fas fa-sun"></i> Morning</span><ul><li>Empty stomach: Coriander (Dhaniya) seed water.</li><li>Breakfast: Boiled eggs or nuts (Brazil nuts are great).</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> Afternoon</span><ul><li>Lunch: Brown rice, well-cooked spinach/kale. <strong>Avoid raw cruciferous veggies (cabbage/cauliflower).</strong></li></ul><span class="meal-time"><i class="fas fa-moon"></i> Night</span><ul><li>Dinner: Roasted vegetables, light chicken or tofu.</li></ul>`;
                diet.hi = `<span class="meal-time"><i class="fas fa-sun"></i> सुबह</span><ul><li>खाली पेट: धनिया के बीज का पानी।</li><li>नाश्ता: उबले अंडे या मेवे।</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> दोपहर</span><ul><li>दोपहर का भोजन: ब्राउन राइस, अच्छी तरह पकी हुई पालक। <strong>कच्ची गोभी/फूलगोभी से बचें।</strong></li></ul><span class="meal-time"><i class="fas fa-moon"></i> रात</span><ul><li>रात का खाना: भुनी हुई सब्जियां, हल्का चिकन या टोफू।</li></ul>`;
                exercise.en = `<ul><li><strong>Cardio:</strong> 30 minutes of moderate cardio to boost metabolism.</li><li><strong>Yoga:</strong> Ujjayi Pranayama and Matsyasana (Fish Pose) are excellent for stimulating the thyroid gland.</li></ul>`;
                exercise.hi = `<ul><li><strong>कार्डियो:</strong> चयापचय को बढ़ावा देने के लिए 30 मिनट का मध्यम कार्डियो।</li><li><strong>योग:</strong> थायरॉयड ग्रंथि को उत्तेजित करने के लिए उज्जायी प्राणायाम और मत्स्यासन उत्कृष्ट हैं।</li></ul>`;
            } else {
                diet.en = `<span class="meal-time"><i class="fas fa-sun"></i> Morning</span><ul><li>Empty stomach: Warm lemon water.</li><li>Breakfast: Protein-rich breakfast (Eggs, Dal chilla, or sprouts).</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> Afternoon</span><ul><li>Lunch: A balanced plate (50% vegetables, 25% complex carbs, 25% protein).</li></ul><span class="meal-time"><i class="fas fa-moon"></i> Night</span><ul><li>Dinner: Light, easily digestible meal at least 2 hours before bed.</li></ul>`;
                diet.hi = `<span class="meal-time"><i class="fas fa-sun"></i> सुबह</span><ul><li>खाली पेट: गर्म नींबू पानी।</li><li>नाश्ता: प्रोटीन युक्त नाश्ता (अंडे, दाल का चीला, या अंकुरित अनाज)।</li></ul><span class="meal-time"><i class="fas fa-cloud-sun"></i> दोपहर</span><ul><li>दोपहर का भोजन: एक संतुलित थाली (50% सब्जियां, 25% कार्ब्स, 25% प्रोटीन)।</li></ul><span class="meal-time"><i class="fas fa-moon"></i> रात</span><ul><li>रात का खाना: सोने से कम से कम 2 घंटे पहले हल्का, आसानी से पचने वाला भोजन।</li></ul>`;
                exercise.en = `<ul><li><strong>Physical Activity:</strong> Stay active. Aim for at least 30 minutes of physical activity daily.</li><li><strong>Yoga:</strong> Suryanamaskar (Sun Salutation) is a complete body workout. Practice basic stretching.</li></ul>`;
                exercise.hi = `<ul><li><strong>शारीरिक गतिविधि:</strong> सक्रिय रहें। रोजाना कम से कम 30 मिनट की शारीरिक गतिविधि का लक्ष्य रखें।</li><li><strong>योग:</strong> सूर्य नमस्कार एक संपूर्ण शारीरिक कसरत है। बुनियादी स्ट्रेचिंग का अभ्यास करें।</li></ul>`;
            }

            document.getElementById('dietPlanContent').innerHTML = currentLang === 'en' ? diet.en : diet.hi;
            document.getElementById('exercisePlanContent').innerHTML = currentLang === 'en' ? exercise.en : exercise.hi;
        }

        window.checkUpdateVitals = function() {
            const todayKey = `vitals_${patientData.email}_${new Date().toLocaleDateString()}`;
            if(localStorage.getItem(todayKey)) {
                showToast(currentLang === 'en' ? "⚠️ You have already updated your health today!" : "⚠️ आप आज अपना स्वास्थ्य अपडेट कर चुके हैं!");
            } else {
                openModal('updateModal');
            }
        }

        window.checkMedicines = function(meds) {
            const now = new Date(); const currentTotalMins = (now.getHours() * 60) + now.getMinutes();
            let missedMeds = [], upcomingMeds = [];
            meds.forEach(m => {
                if(!m.time || localStorage.getItem(`taken_${patientData.email}_${m.name}_${now.toLocaleDateString()}`)) return;
                const [medHours, medMinutes] = m.time.split(':').map(Number);
                const diff = currentTotalMins - ((medHours * 60) + medMinutes);
                if (diff > 30) missedMeds.push(m); else if (diff >= -30 && diff <= 30) upcomingMeds.push(m);
            });

            if(missedMeds.length > 0) { document.getElementById('missedMedBannerText').innerText = missedMeds.map(m => `${m.name} (${m.time})`).join(' • '); document.getElementById('missedMedBanner').style.display = 'flex'; } else { document.getElementById('missedMedBanner').style.display = 'none'; }
            if(upcomingMeds.length > 0) { document.getElementById('upcomingMedBannerText').innerText = upcomingMeds.map(m => `${m.name} (${m.time})`).join(' • '); document.getElementById('upcomingMedBanner').style.display = 'flex'; } else { document.getElementById('upcomingMedBanner').style.display = 'none'; }
        }

        window.verifyMedicineTime = function(medName, prescribedTimeStr, btnIndex) {
            const now = new Date(); const diff = ((now.getHours() * 60) + now.getMinutes()) - ((prescribedTimeStr.split(':')[0] * 60) + Number(prescribedTimeStr.split(':')[1]));
            if (diff < -30) {
                const currentTimeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                document.getElementById('earlyMedWarningText').innerHTML = `<span class="lang-text" data-en="It is currently" data-hi="अभी समय है">It is currently</span> <strong>${currentTimeString}</strong>.<br><br><strong>${medName}</strong> <span class="lang-text" data-en="is prescribed strictly for" data-hi="का निर्धारित समय है">is prescribed strictly for</span> <strong>${prescribedTimeStr}</strong>.<br><br><span class="lang-text" data-en="It is too early to log this medication." data-hi="इस दवा को लेने के लिए अभी बहुत जल्दी है।">It is too early to log this medication.</span>`;
                openModal('earlyMedWarningModal'); applyLanguage();
            }
            else if (diff > 30) {
                document.getElementById('missedMedWarningText').innerHTML = `<span class="lang-text" data-en="You have missed the safe 30-minute window to take" data-hi="आपने दवा लेने का 30 मिनट का सुरक्षित समय गँवा दिया है:">You have missed the safe 30-minute window to take</span> <strong>${medName}</strong> (<span class="lang-text" data-en="Scheduled for" data-hi="निर्धारित">Scheduled for</span> ${prescribedTimeStr}).<br><br><span class="lang-text" data-en="Please contact your doctor to see if you should still take it." data-hi="कृपया अपने डॉक्टर से संपर्क करें और पूछें कि क्या आपको अभी भी इसे लेना चाहिए।">Please contact your doctor to see if you should still take it.</span>`;
                openModal('missedMedWarningModal'); applyLanguage();
            }
            else {
                localStorage.setItem(`taken_${patientData.email}_${medName}_${now.toLocaleDateString()}`, "true");
                showToast('<i class="fas fa-shield-alt"></i> Medication logged safely!');
                setTimeout(() => location.reload(), 1000); 
            }
        }

        window.openChatModal = function() { openModal('chatModal'); renderChat(); }
        
        window.renderChat = function() {
            const chatBox = document.getElementById('chatBox'); const history = patientData.chatHistory || [];
            if(history.length === 0) { 
                chatBox.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:0.9rem;"><span class="lang-text" data-en="Chat started with your Doctor" data-hi="आपके डॉक्टर के साथ चैट शुरू हुई">Chat started with your Doctor</span></p>'; 
                applyLanguage(); return; 
            }
            chatBox.innerHTML = history.map(c => { const isPat = c.sender === 'patient'; return `<div class="msg ${isPat ? 'pat' : 'doc'}"><strong style="font-size:0.75rem; opacity:0.8; display:block; margin-bottom:3px;"><span class="lang-text" data-en="${isPat ? 'You' : 'Doctor'}" data-hi="${isPat ? 'आप' : 'डॉक्टर'}">${isPat ? 'You' : 'Doctor'}</span> - ${c.time}</strong>${c.message}</div>`; }).join('');
            chatBox.scrollTop = chatBox.scrollHeight; applyLanguage();
        }

        window.sendMessage = async function() {
            const input = document.getElementById('chatInput'); const text = input.value.trim(); if(!text) return;
            const freshRes = await fetch(`/api/patients/me/${patientData.email}`);
            const freshData = await freshRes.json();
            const newMsg = { sender: 'patient', message: text, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
            const updatedHistory = [...(freshData.chatHistory || []), newMsg];
            const res = await fetch(`/api/patients/update/${patientData.email}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chatHistory: updatedHistory }) });
            if(res.ok) { patientData.chatHistory = updatedHistory; input.value = ''; renderChat(); }
        }

        let currentBase64Image = null;

        window.handleImageSelect = function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onloadend = () => {
                currentBase64Image = reader.result; 
                document.getElementById('imagePreviewContainer').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }

        window.sendAIMessage = async function() {
            const input = document.getElementById('aiChatInput'); 
            const text = input.value.trim(); 
            if(!text && !currentBase64Image) return;

            const chatBox = document.getElementById('aiChatBox');
            
            let userMsgHtml = text || "Uploaded an image for analysis.";
            if(currentBase64Image) userMsgHtml += `<br><i class="fas fa-camera" style="color:#94a3b8; margin-top:5px;"></i> <span style="font-size:0.8rem;">[Image Attached]</span>`;
            
            chatBox.innerHTML += `<div class="msg pat" style="background: #1e3c72;"><strong style="font-size:0.75rem; opacity:0.8; display:block; margin-bottom:3px;">You</strong>${userMsgHtml}</div>`;
            
            input.value = '';
            document.getElementById('imagePreviewContainer').style.display = 'none';
            chatBox.scrollTop = chatBox.scrollHeight;

            document.getElementById('aiTyping').style.display = 'block';

            try {
                const response = await fetch(`/api/patients/ai-predictive-triage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                document.getElementById('aiTriageText').innerHTML = `<strong>Assessment:</strong> ${data.analysis}`;
                
                // ✨ THE MISSING COLOR LOGIC ✨
                const triageBox = document.getElementById('aiTriageResult');
                if (data.riskLevel === 'HIGH') {
                    triageBox.style.backgroundColor = '#FDE8E8'; 
                    triageBox.style.border = '2px solid #F98080';
                    triageBox.style.color = '#9B1C1C';
                } 
                else if (data.riskLevel === 'MEDIUM') {
                    triageBox.style.backgroundColor = '#FEF08A'; 
                    triageBox.style.border = '2px solid #EAB308';
                    triageBox.style.color = '#713F12';
                } 
                else {
                    triageBox.style.backgroundColor = '#DEF7EC'; 
                    triageBox.style.border = '2px solid #31C48D';
                    triageBox.style.color = '#03543F';
                }
                
            } catch (err) {
                document.getElementById('aiTriageText').innerText = "Error running AI triage. Please ensure your backend is configured.";
                console.error(err);
            }
        }

        setInterval(async () => {
            if(document.getElementById('chatModal').style.display === 'flex') {
                const freshRes = await fetch(`/api/patients/me/${patientData.email}`);
                const freshData = await freshRes.json();
                if (freshData.chatHistory && freshData.chatHistory.length !== (patientData.chatHistory || []).length) {
                    patientData.chatHistory = freshData.chatHistory; renderChat();
                }
            }
        }, 3000);

        window.openModal = function(id) { document.getElementById(id).style.display = 'flex'; }
        window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; }
        
        window.saveVitals = async function() {
            const bp = document.getElementById('inBP').value, sugar = document.getElementById('inSugar').value, hr = document.getElementById('inHR').value, sym = document.getElementById('inSym').value;
            let updatedSymptoms = sym ? [sym] : []; 
            const res = await fetch(`/api/patients/update/${patientData.email}`, { 
                method: 'PUT', headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ currentBP: bp, bloodSugar: sugar, heartRate: hr, symptoms: updatedSymptoms }) 
            });
            if(res.ok) { 
                const todayKey = `vitals_${patientData.email}_${new Date().toLocaleDateString()}`;
                localStorage.setItem(todayKey, "true");
                showToast(currentLang === 'en' ? "Vitals Updated Successfully!" : "विवरण सफलतापूर्वक अपडेट हो गए!"); 
                setTimeout(() => location.reload(), 1500); 
            }
        }

        let pCharts = { hr: null, bp: null, sugar: null, hemo: null };
        window.renderPatientCharts = function() {
            const history = patientData.historicalVitals || []; if(history.length === 0) return;
            if(pCharts.hr) pCharts.hr.destroy(); if(pCharts.bp) pCharts.bp.destroy(); if(pCharts.sugar) pCharts.sugar.destroy(); if(pCharts.hemo) pCharts.hemo.destroy();
            const dates = history.map(v => v.date); const opts = { maintainAspectRatio: false, plugins: { legend: { display: false } } };
            pCharts.hr = new Chart(document.getElementById('pChartHR').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.heartRate), borderColor: '#0ea5e9', tension: 0.4 }]}, options: opts });
            pCharts.bp = new Chart(document.getElementById('pChartBP').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.systolic), borderColor: '#e11d48', tension: 0.4 }, { data: history.map(v => v.diastolic), borderColor: '#d97706', borderDash: [5,5], tension: 0.4 }]}, options: opts });
            pCharts.sugar = new Chart(document.getElementById('pChartSugar').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.sugar), borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', fill: true, tension: 0.4 }]}, options: opts });
            pCharts.hemo = new Chart(document.getElementById('pChartHemo').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.hemoglobin), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', fill: true, tension: 0.4 }]}, options: opts });
        }
        window.showToast = function(msg) { const t = document.getElementById('toast'); t.innerHTML = msg; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 4000); }
        window.handleLogout = function() { localStorage.removeItem('currentUser'); window.location.href = 'login.html'; }
        
        // Start the dashboard
        init();
    }
});

// --- DOCTOR DASHBOARD LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    // Safety check: Only run this code if the Doctor Dashboard is active on the screen
    if (document.getElementById('doctorName')) {

        let allPatients = []; 
        let currentDashCharts = { bp: null, sugar: null, hemo: null, hr: null };

        // Make functions global so HTML can trigger them
        window.switchTab = function(tabName) {
            document.querySelectorAll('.section-view, .sidebar-item').forEach(el => el.classList.remove('active'));
            document.getElementById(`view-${tabName}`).classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        }

        window.handleLogout = function() {
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        }

        window.dischargePatient = async function(dbId) {
            if(confirm("Are you sure you want to discharge this patient?")) {
                try {
                    const response = await fetch(`/api/patients/remove/${dbId}`, { method: 'DELETE' });
                    if(response.ok) loadDashboardData(); 
                } catch(err) { console.error(err); }
            }
        }

        window.runAIPrediction = async function() {
            const email = document.getElementById('analyticsPatientSelect').value;
            if(!email) return;

            document.getElementById('aiTriageResult').style.display = 'block';
            document.getElementById('aiTriageText').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gemini is analyzing the patient\'s historical vitals...';

            try {
                const response = await fetch(`/api/patients/ai-predictive-triage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                document.getElementById('aiTriageText').innerHTML = `<strong>Assessment:</strong> ${data.analysis}`;
                
            } catch (err) {
                document.getElementById('aiTriageText').innerText = "Error running AI triage. Please ensure your backend is configured.";
                console.error(err);
            }
        }

        async function loadDashboardData() {
            try {
                const userString = localStorage.getItem('currentUser');
                if (!userString) return window.location.href = 'login.html';
                const currentUser = JSON.parse(userString);
                
                document.getElementById('doctorName').innerText = `Dr. ${currentUser.name || 'Doctor'}`;
                
                // Populate Profile Tab
                document.getElementById('docProfileName').innerText = `Dr. ${currentUser.name}`;
                document.getElementById('docProfileId').innerText = `ID: ${currentUser.assignedId}`;
                document.getElementById('docProfileEmail').innerText = currentUser.email;

                const response = await fetch(`/api/patients/doctor/${currentUser.assignedId}`);

                if (response.ok) {
                    allPatients = await response.json(); 

                    document.getElementById('totalPatientsCount').innerText = allPatients.length;
                    document.getElementById('criticalCasesCount').innerText = allPatients.filter(p => (p.healthStatus || '').toLowerCase() === 'critical').length;
                    
                    const today = new Date();
                    document.getElementById('appointmentsCount').innerText = allPatients.filter(p => {
                        if (!p.nextAppointment) return false;
                        const apptDate = new Date(p.nextAppointment);
                        return apptDate.getFullYear() === today.getFullYear() && apptDate.getMonth() === today.getMonth() && apptDate.getDate() === today.getDate();
                    }).length; 

                    const diseaseSelect = document.getElementById('filterDisease');
                    const currentDiseaseSelection = diseaseSelect.value;
                    const uniqueDiseases = [...new Set(allPatients.map(p => p.primaryDisease).filter(Boolean))];
                    diseaseSelect.innerHTML = '<option value="all">All Diseases</option>' + uniqueDiseases.map(d => `<option value="${d}">${d}</option>`).join('');
                    diseaseSelect.value = currentDiseaseSelection || 'all';

                    const patientSelect = document.getElementById('analyticsPatientSelect');
                    const currentAnalyticSelection = patientSelect.value;
                    patientSelect.innerHTML = '<option value="">-- Select a Patient --</option>' + allPatients.map(p => `<option value="${p.email}">${p.patientId} - ${p.name || 'Unknown'}</option>`).join('');
                    patientSelect.value = currentAnalyticSelection;

                    renderPatientTable();
                }
            } catch (error) { 
                console.error(error); 
            }
        }

        function renderPatientTable() {
            const tableBody = document.getElementById('patientTableBody');
            const searchName = document.getElementById('searchName').value.toLowerCase();
            const filterStatus = document.getElementById('filterStatus').value.toLowerCase();
            const filterDisease = document.getElementById('filterDisease').value;

            const filteredPatients = allPatients.filter(p => {
                const matchName = (p.name || '').toLowerCase().includes(searchName);
                const matchStatus = filterStatus === 'all' || (p.healthStatus || 'stable').toLowerCase() === filterStatus;
                const matchDisease = filterDisease === 'all' || p.primaryDisease === filterDisease;
                return matchName && matchStatus && matchDisease;
            });

            tableBody.innerHTML = ''; 
            if (filteredPatients.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">No matching patients found.</td></tr>';
                return;
            }

            filteredPatients.forEach(patient => {
                // 1. Dynamic Status Colors
                let statusRaw = (patient.healthStatus || 'stable').toLowerCase();
                let statusBgColor = '#DEF7EC'; // Green
                let statusTextColor = '#03543F';

                if (statusRaw === 'critical') {
                    statusBgColor = '#FDE8E8'; // Red
                    statusTextColor = '#9B1C1C';
                } else if (statusRaw === 'moderate') {
                    statusBgColor = '#FEF08A'; // Yellow
                    statusTextColor = '#713F12';
                }

                // 2. Date Fallback Logic
                let niceDate = "Not Scheduled";
                if (patient.nextAppointment) {
                    const apptDate = new Date(patient.nextAppointment);
                    const now = new Date();
                    if (apptDate < now) {
                        niceDate = `<span style="color: #94a3b8; font-weight: bold;"><i class="fas fa-check-circle"></i> Passed</span>`;
                    } else {
                        niceDate = apptDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    }
                }

                const viewBtn = `<button onclick="window.location.href='patient-profile.html?email=${patient.email}'" style="background:#38bdf8; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; margin-right:5px; font-weight:bold;"><i class="fas fa-eye"></i> View</button>`;
                const dischargeBtn = `<button onclick="dischargePatient('${patient._id}')" style="background:#e11d48; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-user-check"></i> Discharge</button>`;

                tableBody.innerHTML += `
                    <tr>
                        <td style="font-weight: bold; color: #1e3c72;">${patient.patientId || 'N/A'}</td>
                        <td style="font-weight: bold; color: #1e293b;">${patient.name || 'Unknown'}</td>
                        <td>${patient.primaryDisease || 'N/A'}</td>
                        <td>${niceDate.includes('Passed') || niceDate === 'Not Scheduled' ? niceDate : `<i class="far fa-calendar-alt" style="color:#64748b; margin-right:5px;"></i> ${niceDate}`}</td>
                        <td>
                            <span style="background-color: ${statusBgColor}; color: ${statusTextColor}; padding: 4px 8px; border-radius: 4px; font-weight: bold; display: inline-block;">
                                ${statusRaw.toUpperCase()}
                            </span>
                        </td>
                        <td>${viewBtn} ${dischargeBtn}</td>
                    </tr>`;
            });
        }

        function renderAnalyticsCharts(p) {
            const history = p.historicalVitals || [];
            
            if (currentDashCharts.bp) currentDashCharts.bp.destroy();
            if (currentDashCharts.sugar) currentDashCharts.sugar.destroy();
            if (currentDashCharts.hemo) currentDashCharts.hemo.destroy();
            if (currentDashCharts.hr) currentDashCharts.hr.destroy();

            if (history.length === 0) return; 

            const dates = history.map(v => v.date);
            const commonOptions = { maintainAspectRatio: false, plugins: { legend: { display: false } } };

            currentDashCharts.bp = new Chart(document.getElementById('dashChartBP').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.systolic), borderColor: '#e11d48', tension: 0.4 }, { data: history.map(v => v.diastolic), borderColor: '#d97706', borderDash: [5,5], tension: 0.4 }]}, options: commonOptions });
            currentDashCharts.sugar = new Chart(document.getElementById('dashChartSugar').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.sugar), borderColor: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.1)', fill: true, tension: 0.4 }]}, options: commonOptions });
            currentDashCharts.hemo = new Chart(document.getElementById('dashChartHemo').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.hemoglobin), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', fill: true, tension: 0.4 }]}, options: commonOptions });
            currentDashCharts.hr = new Chart(document.getElementById('dashChartHR').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.heartRate), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 }]}, options: commonOptions });
        }

        // Event Listeners
        document.getElementById('searchName').addEventListener('input', renderPatientTable);
        document.getElementById('filterStatus').addEventListener('change', renderPatientTable);
        document.getElementById('filterDisease').addEventListener('change', renderPatientTable);

        document.getElementById('analyticsPatientSelect').addEventListener('change', async function() {
            const email = this.value;
            const grid = document.getElementById('analyticsChartsGrid');
            const emptyState = document.getElementById('analyticsEmptyState');
            const triageBtn = document.getElementById('runTriageBtn');
            const triageResult = document.getElementById('aiTriageResult');

            if (!email) {
                grid.style.display = 'none';
                emptyState.style.display = 'block';
                triageBtn.style.display = 'none';
                triageResult.style.display = 'none';
                return;
            }

            try {
                const res = await fetch(`/api/patients/me/${email}`);
                const patient = await res.json();
                emptyState.style.display = 'none';
                grid.style.display = 'grid';
                triageBtn.style.display = 'flex'; 
                triageResult.style.display = 'none'; 
                renderAnalyticsCharts(patient);
            } catch (err) { console.error(err); }
        });

        // Initialize Dashboard
        loadDashboardData();
        setInterval(loadDashboardData, 30000); 
    }
});

// --- ADD PATIENT LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    // Safety check: Only run if the Add Patient form is on the screen
    const addPatientForm = document.getElementById('addPatientForm');
    
    if (addPatientForm) {
        // 1. Load Doctor's Name
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) document.getElementById('doctorName').innerText = `Dr. ${user.name}`;

        // 2. Add Medicine Row Button
        const addMedicineBtn = document.getElementById('addMedicine');
        if (addMedicineBtn) {
            addMedicineBtn.addEventListener('click', function() {
                const entry = document.createElement('div');
                entry.className = 'medicine-entry';
                entry.innerHTML = `<input type="text" placeholder="Medicine Name" class="medicine-name" required><input type="text" placeholder="Dosage" class="medicine-dosage" required><input type="time" class="medicine-time" required><button type="button" class="remove-medicine" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>`;
                document.getElementById('medicineSchedule').appendChild(entry);
            });
        }

        // 3. Handle Form Submission
        addPatientForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));
            if (!currentUser) return window.location.href = 'login.html';

            let medicinesList = [];
            document.querySelectorAll('.medicine-entry').forEach(entry => {
                const name = entry.querySelector('.medicine-name').value;
                if (name) {
                    medicinesList.push({ 
                        name: name, 
                        dosage: entry.querySelector('.medicine-dosage').value, 
                        time: entry.querySelector('.medicine-time').value 
                    });
                }
            });

            const patientData = {
                name: document.getElementById('patientName')?.value || "",
                patientId: document.getElementById('patientId')?.value || "",
                email: document.getElementById('patientEmail')?.value || "",
                age: document.getElementById('age')?.value || "",
                gender: document.getElementById('gender')?.value || "",
                primaryDisease: document.getElementById('primaryDisease')?.value || "",
                currentBP: document.getElementById('currentBP')?.value || "120/80",
                bloodSugar: document.getElementById('bloodSugar')?.value || 0,
                hemoglobin: document.getElementById('hemoglobin')?.value || 0,
                nextAppointment: document.getElementById('nextAppointment')?.value || "",
                healthStatus: document.getElementById('healthStatus')?.value || "Stable",
                medicines: medicinesList, 
                assignedDoctorId: currentUser?.assignedId || ""
            };

            try {
                const response = await fetch('/api/patients/add', {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(patientData)
                });
                
                if (response.ok) {
                    window.location.href = 'doctor-dashboard.html';
                } else {
                    const errorData = await response.json();
                    alert("❌ " + (errorData.message || "Failed to add patient."));
                }
            } catch (error) { 
                console.error("Error saving patient:", error); 
                alert("🚨 Network error. Make sure your server is running.");
            }
        });
    }
});

// --- PATIENT PROFILE (DOCTOR VIEW) LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    // Safety check: Only run this on the Patient Profile page
    if (document.getElementById('doctorStatusSelect') && document.getElementById('pName')) {
        
        const urlParams = new URLSearchParams(window.location.search);
        const profileEmail = urlParams.get('email');
        let profileData = null;

        window.switchTab = function(tabId, btn) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            btn.classList.add('active');
        };

        window.initProfile = async function() {
            if (!profileEmail) return;
            try {
                const res = await fetch(`/api/patients/me/${profileEmail}`);
                profileData = await res.json();
                
                document.getElementById('pName').innerText = profileData.name;
                document.getElementById('pId').innerText = profileData.patientId;
                document.getElementById('pAge').innerText = profileData.age || '--';
                document.getElementById('pDisease').innerText = profileData.primaryDisease || 'N/A';
                
                const statusEl = document.getElementById('pStatus');
                statusEl.innerText = (profileData.healthStatus || 'STABLE').toUpperCase();
                
                if(profileData.healthStatus === 'stable') { statusEl.style.background = '#dcfce7'; statusEl.style.color = '#166534'; }
                if(profileData.healthStatus === 'moderate') { statusEl.style.background = '#fef08a'; statusEl.style.color = '#854d0e'; }
                if(profileData.healthStatus === 'critical') { statusEl.style.background = '#fee2e2'; statusEl.style.color = '#e11d48'; }

                document.getElementById('vHR').innerHTML = `${profileData.heartRate || '--'} <span>bpm</span>`;
                document.getElementById('vBP').innerText = profileData.currentBP || '--';
                document.getElementById('vSugar').innerHTML = `${profileData.bloodSugar || '--'} <span>mg/dL</span>`;
                document.getElementById('vHemo').innerHTML = `${profileData.hemoglobin || '--'} <span>g/dL</span>`;
                
                let apptDisplay = 'None Scheduled';
                if (profileData.nextAppointment) {
                    const apptDate = new Date(profileData.nextAppointment);
                    if (apptDate < new Date()) { 
                        apptDisplay = `<span style="color: #94a3b8;"><i class="fas fa-check-circle"></i> Passed / Attended (${apptDate.toLocaleDateString()})</span>`; 
                    } else { 
                        apptDisplay = apptDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + apptDate.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'}); 
                    }
                }
                document.getElementById('vAppt').innerHTML = apptDisplay;

                const symArea = document.getElementById('symptomsList');
                if (profileData.symptoms && profileData.symptoms.length > 0) {
                    symArea.innerHTML = profileData.symptoms.map(s => `<span class="symptom-badge"><i class="fas fa-exclamation-circle"></i> ${s}</span>`).join('');
                } else { 
                    symArea.innerHTML = `<span class="symptom-badge" style="background:#f1f5f9; color:#64748b;"><i class="fas fa-check"></i> No symptoms reported</span>`; 
                }

                const telemedBox = document.getElementById('telemedCenterBox');
                if (profileData.nextTelemedSession && profileData.nextTelemedSession.link) {
                    telemedBox.innerHTML = `
                        <i class="fas fa-video" style="font-size: 60px; color: #10b981; margin-bottom: 20px;"></i>
                        <h2 style="color: #1e3c72;">Active Video Consultation</h2>
                        <p style="color: #64748b; margin-bottom: 20px;">Session scheduled for: <strong>${profileData.nextTelemedSession.date} at ${profileData.nextTelemedSession.time}</strong></p>
                        <a href="${profileData.nextTelemedSession.link}" target="_blank" class="btn-main" style="width: 100%; justify-content: center; background: #10b981; text-decoration: none;">
                            <i class="fas fa-phone-alt"></i> Join Video Call Now
                        </a>
                        <hr style="border: 1px solid #e2e8f0; margin: 30px 0;">
                        <h4 style="color: #475569;">Schedule a New Session</h4>
                        <input type="datetime-local" id="teleDateTime" style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 20px; font-family: inherit;">
                        <button class="btn-main" style="width: 100%; justify-content: center;" onclick="scheduleTelemed()"><i class="fas fa-calendar-plus"></i> Generate New Link</button>
                    `;
                } else {
                    telemedBox.innerHTML = `
                        <i class="fas fa-laptop-medical" style="font-size: 60px; color: #0ea5e9; margin-bottom: 20px;"></i>
                        <h2 style="color: #1e3c72;">Virtual Video Consultation</h2>
                        <p style="color: #64748b; margin-bottom: 30px;">Schedule a secure Video session. The patient will receive an automated link.</p>
                        <input type="datetime-local" id="teleDateTime" style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 20px; font-family: inherit;">
                        <button class="btn-main" style="width: 100%; justify-content: center;" onclick="scheduleTelemed()"><i class="fas fa-video"></i> Schedule & Notify</button>
                    `;
                }

                renderMedicines();
                renderCharts();
                renderDoctorChat(); 
            } catch (err) { console.error(err); }
        };

        window.updateHealthStatus = async function(newStatus) {
            if(!newStatus) return;
            if(!confirm(`Are you sure you want to mark this patient as ${newStatus.toUpperCase()}?`)) { 
                document.getElementById('doctorStatusSelect').value = ""; return; 
            }
            try {
                const res = await fetch(`/api/patients/update/${profileEmail}`, { 
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ healthStatus: newStatus }) 
                });
                if (res.ok) { 
                    showProfileToast(`<i class="fas fa-check-circle"></i> Patient marked as ${newStatus.toUpperCase()}`); 
                    document.getElementById('doctorStatusSelect').value = ""; initProfile(); 
                }
            } catch(e) { console.error(e); }
        };

        function renderDoctorChat() {
            const chatBox = document.getElementById('docChatBox');
            const history = profileData.chatHistory || [];
            if(history.length === 0) { 
                chatBox.innerHTML = '<p style="text-align:center; color:#94a3b8;">Chat started with Patient.</p>'; return; 
            }
            chatBox.innerHTML = history.map(c => {
                const isDoc = c.sender === 'doctor';
                const bg = isDoc ? '#38bdf8' : '#e2e8f0'; const color = isDoc ? 'white' : '#1e293b'; const align = isDoc ? 'flex-end' : 'flex-start';
                return `<div style="max-width: 70%; padding: 10px 15px; border-radius: 15px; background: ${bg}; color: ${color}; align-self: ${align}; font-size: 0.9rem;">
                    <strong style="font-size:0.75rem; opacity:0.8; display:block; margin-bottom:3px;">${isDoc ? 'You' : 'Patient'} - ${c.time}</strong>${c.message}</div>`;
            }).join('');
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        window.sendDoctorMessage = async function() {
            const input = document.getElementById('docChatInput'); const text = input.value.trim(); if(!text) return;
            const freshRes = await fetch(`/api/patients/me/${profileEmail}`);
            const freshData = await freshRes.json();
            const newMsg = { sender: 'doctor', message: text, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) };
            const updatedHistory = [...(freshData.chatHistory || []), newMsg];
            const res = await fetch(`/api/patients/update/${profileEmail}`, { 
                method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chatHistory: updatedHistory }) 
            });
            if(res.ok) { profileData.chatHistory = updatedHistory; input.value = ''; renderDoctorChat(); }
        };

        function renderMedicines() {
            const list = document.getElementById('medicineList');
            if(!profileData.medicines || profileData.medicines.length === 0) { 
                list.innerHTML = "<p>No prescriptions found.</p>"; return; 
            }
            list.innerHTML = profileData.medicines.map((m, index) => `
                <div class="med-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid #f1f5f9;">
                    <div>
                        <h4 style="margin: 0 0 5px 0; color: #1e3c72;">${m.name}</h4>
                        <p style="margin: 0; color: #475569; font-size: 0.9rem;">Dosage: ${m.dosage}</p>
                        <span class="med-time"><i class="far fa-clock"></i> ${m.time}</span>
                    </div>
                    <button class="btn-remove" onclick="removeMedicine(${index})"><i class="fas fa-times"></i></button>
                </div>
            `).join('');
        }

        window.addMedicine = async function() {
            const name = document.getElementById('newMedName').value, dosage = document.getElementById('newMedDose').value, time = document.getElementById('newMedTime').value;
            if(!name || !dosage || !time) return alert("Fill all fields");
            const newMeds = [...(profileData.medicines || []), { name, dosage, time }];
            await updateDatabaseMeds(newMeds);
            document.getElementById('newMedName').value = ''; document.getElementById('newMedDose').value = ''; document.getElementById('newMedTime').value = '';
        };
        
        window.removeMedicine = async function(index) { 
            if(!confirm("Remove this medicine?")) return; 
            const newMeds = [...profileData.medicines]; newMeds.splice(index, 1); await updateDatabaseMeds(newMeds); 
        };
        
        async function updateDatabaseMeds(newMeds) { 
            try { 
                const res = await fetch(`/api/patients/update/${profileEmail}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ medicines: newMeds }) }); 
                if(res.ok) { profileData.medicines = newMeds; renderMedicines(); } 
            } catch(e) { console.error(e); } 
        }

        function renderCharts() {
            const history = profileData.historicalVitals || []; 
            if(history.length === 0) return;
            
            const dates = history.map(v => v.date); 
            const opts = { maintainAspectRatio: false, plugins: { legend: { display: false } } };
            
            new Chart(document.getElementById('cBP').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.systolic), borderColor: '#e11d48', tension: 0.4 }, { data: history.map(v => v.diastolic), borderColor: '#d97706', borderDash: [5,5], tension: 0.4 }]}, options: opts });
            new Chart(document.getElementById('cSugar').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.sugar), borderColor: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.1)', fill: true, tension: 0.4 }]}, options: opts });
            new Chart(document.getElementById('cHemo').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.hemoglobin), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', fill: true, tension: 0.4 }]}, options: opts });
            new Chart(document.getElementById('cHR').getContext('2d'), { type: 'line', data: { labels: dates, datasets: [{ data: history.map(v => v.heartRate), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 }]}, options: opts });
        }

        window.scheduleAppt = async function() {
            const date = document.getElementById('apptDate').value, time = document.getElementById('apptTime').value; if(!date || !time) return;
            await fetch('/api/patients/schedule-appointment', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: profileEmail, date, time }) });
            document.getElementById('apptModal').style.display='none'; showProfileToast("Appointment Scheduled & Patient Notified!"); initProfile(); 
        };

        window.scheduleTelemed = async function() {
            const dt = document.getElementById('teleDateTime').value; if(!dt) return; 
            const [date, time] = dt.split('T');
            const res = await fetch('/api/patients/schedule-telemed', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: profileEmail, date, time }) });
            await res.json(); 
            showProfileToast(`<i class="fas fa-video"></i> Video Room Link Generated!`);
            setTimeout(() => location.reload(), 1500); 
        };
        
        window.showProfileToast = function(msg) { const t = document.getElementById('toast'); t.innerHTML = msg; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 4500); }

        // Start polling for new chats
        setInterval(async () => {
            const tabChat = document.getElementById('tab-chat');
            if(tabChat && tabChat.classList.contains('active') && profileEmail) {
                const freshRes = await fetch(`/api/patients/me/${profileEmail}`);
                const freshData = await freshRes.json();
                if (freshData.chatHistory && freshData.chatHistory.length !== (profileData.chatHistory || []).length) {
                    profileData.chatHistory = freshData.chatHistory; renderDoctorChat();
                }
            }
        }, 3000);

        // Kick off the script
        initProfile();
    }
});


// --- VERIFY OTP LOGIC ---
async function verifyAccount() {
    const otpInput = document.getElementById('otpCode');
    if (!otpInput) return; // Safety check: only run if the input exists

    const email = localStorage.getItem('emailToVerify');
    const otp = otpInput.value;

    if (!email) {
        alert("Verification session expired. Please register again.");
        window.location.href = 'register.html';
        return;
    }

    try {
        const response = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });

        const data = await response.json();

        if (response.ok) {
            alert("✅ Verification successful! Redirecting to login...");
            localStorage.removeItem('emailToVerify'); // Clean up memory
            window.location.href = 'login.html';
        } else {
            alert("❌ Verification failed: " + data.message);
        }
    } catch (err) {
        console.error("Verification error:", err);
        alert("🚨 Request failed. Ensure the server is running.");
    }
}