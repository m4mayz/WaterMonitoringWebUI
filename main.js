// Firebase SDK is loaded via CDN in index.html
// This script contains all the JavaScript logic from the original HTML

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBTZj1bgHDSSFRl_GLr7RMetZatFC_Zraw",
    authDomain: "waterqualitymonitor-1bd0f.firebaseapp.com",
    databaseURL:
        "https://waterqualitymonitor-1bd0f-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "waterqualitymonitor-1bd0f",
    storageBucket: "waterqualitymonitor-1bd0f.firebasestorage.app",
    messagingSenderId: "497357415360",
    appId: "1:497357415360:web:94fe9694fddbb7fea29e25",
    measurementId: "G-YVQ1G1TFZ3",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Application State
let currentPreset = null;
let sensorData = { ppm: 0, ph: 0 };
let deviceOnline = false;
let pumpActive = false;
let editingPreset = null;

// Default Presets
const defaultPresets = [
    {
        name: "Hidroponik",
        ppmMin: 800,
        ppmMax: 1200,
        phMin: 5.5,
        phMax: 6.5,
    },
    {
        name: "Kolam Ikan",
        ppmMin: 150,
        ppmMax: 300,
        phMin: 6.5,
        phMax: 8.5,
    },
];

// Load presets from localStorage or use defaults
let presets =
    JSON.parse(localStorage.getItem("waterPresets")) || defaultPresets;

// DOM Elements
const deviceStatus = document.getElementById("deviceStatus");
const statusText = document.getElementById("statusText");
const presetSelect = document.getElementById("presetSelect");
const addPresetBtn = document.getElementById("addPresetBtn");
const editPresetBtn = document.getElementById("editPresetBtn");
const ppmReading = document.getElementById("ppmReading");
const phReading = document.getElementById("phReading");
const ppmValue = document.getElementById("ppmValue");
const phValue = document.getElementById("phValue");
const ppmStatus = document.getElementById("ppmStatus");
const phStatus = document.getElementById("phStatus");
const pumpBtn = document.getElementById("pumpBtn");
const presetModal = document.getElementById("presetModal");
const modalTitle = document.getElementById("modalTitle");
const presetForm = document.getElementById("presetForm");

// Initialize App
function initApp() {
    loadPresets();
    setupFirebaseListeners();
    setupEventListeners();
    updateUI();
}

// Load presets into dropdown
function loadPresets() {
    presetSelect.innerHTML = '<option value="">Choose preset...</option>';
    presets.forEach((preset, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = preset.name;
        presetSelect.appendChild(option);
    });
}

let lastOnlineTimer = null;
let lastOnlineValue = null;

// Setup Firebase listeners
function setupFirebaseListeners() {
    // Device status listener
    database.ref("/sensor/lastOnline").on("value", (snapshot) => {
        lastOnlineValue = snapshot.val();
        updateDeviceStatus();
    });

    // PPM sensor listener
    database.ref("/sensor/realtime/ppm").on("value", (snapshot) => {
        const ppm = snapshot.val();
        if (ppm !== null) {
            sensorData.ppm = ppm;
            if (deviceOnline) updateSensorUI();
        }
    });

    // pH sensor listener
    database.ref("/sensor/realtime/ph").on("value", (snapshot) => {
        const ph = snapshot.val();
        if (ph !== null) {
            sensorData.ph = ph;
            if (deviceOnline) updateSensorUI();
        }
    });

    // Pump status listener
    database.ref("/sensor/pump").on("value", (snapshot) => {
        const pump = snapshot.val();
        if (pump !== null) {
            pumpActive = pump;
            updatePumpUI();
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    presetSelect.addEventListener("change", (e) => {
        const index = e.target.value;
        if (index !== "") {
            currentPreset = presets[index];
            editPresetBtn.disabled = false;
        } else {
            currentPreset = null;
            editPresetBtn.disabled = true;
        }
        updateSensorUI();
    });

    addPresetBtn.addEventListener("click", () => openModal("add"));
    editPresetBtn.addEventListener("click", () => openModal("edit"));

    pumpBtn.addEventListener("click", togglePump);

    // Modal events
    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("cancelBtn").addEventListener("click", closeModal);
    document
        .getElementById("deleteBtn")
        .addEventListener("click", deletePreset);
    presetForm.addEventListener("submit", savePreset);

    // Close modal when clicking outside
    presetModal.addEventListener("click", (e) => {
        if (e.target === presetModal) closeModal();
    });
}

// Fungsi untuk menghitung selisih waktu dalam format bahasa Inggris
function getTimeAgo(lastOnlineStr) {
    if (!lastOnlineStr) return "";
    const lastDate = new Date(lastOnlineStr.replace(" ", "T") + "+07:00");
    const now = new Date();
    const diffMs = now - lastDate;
    if (isNaN(diffMs)) return "";

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
}

// Update device status UI
function updateDeviceStatus() {
    let online = false;
    let lastOnlineInfo = "";
    if (lastOnlineValue) {
        const lastDate = new Date(lastOnlineValue.replace(" ", "T") + "+07:00");
        const now = new Date();
        const diffSec = (now - lastDate) / 1000;
        online = diffSec < 10; // Online jika < 10 detik
        lastOnlineInfo = getTimeAgo(lastOnlineValue);
    }
    deviceOnline = online;

    if (deviceOnline) {
        deviceStatus.className = "status-container status-online";
        statusText.textContent = lastOnlineInfo ? `Online` : "Online";
        updateSensorUI();
    } else {
        deviceStatus.className = "status-container status-offline";
        statusText.textContent = lastOnlineInfo
            ? `Offline ${lastOnlineInfo}`
            : "Offline";
        // Set sensor value dan status menjadi offline
        ppmValue.textContent = "";
        phValue.textContent = "";
        ppmReading.className = "sensor-reading";
        phReading.className = "sensor-reading";
        ppmStatus.textContent = "Device offline";
        phStatus.textContent = "Device offline";
        pumpBtn.disabled = true;
        pumpBtn.className = "pump-btn";
        pumpBtn.textContent = "💧 Flow the water!";
    }
}

// Update sensor UI
function updateSensorUI() {
    // Update values
    ppmValue.textContent = sensorData.ppm + " PPM";
    phValue.textContent = sensorData.ph.toFixed(1);

    if (!currentPreset) {
        ppmReading.className = "sensor-reading";
        phReading.className = "sensor-reading";
        ppmStatus.textContent = "Choose a preset first";
        phStatus.textContent = "Choose a preset first";
        pumpBtn.disabled = true;
        pumpBtn.className = "pump-btn";
        return;
    }

    // Check PPM range
    const ppmGood =
        sensorData.ppm >= currentPreset.ppmMin &&
        sensorData.ppm <= currentPreset.ppmMax;
    if (ppmGood) {
        ppmReading.className = "sensor-reading good";
        ppmStatus.textContent = "Good";
    } else {
        ppmReading.className = "sensor-reading bad";
        ppmStatus.textContent =
            sensorData.ppm < currentPreset.ppmMin ? "Too Low" : "Too High";
    }

    // Check pH range
    const phGood =
        sensorData.ph >= currentPreset.phMin &&
        sensorData.ph <= currentPreset.phMax;
    if (phGood) {
        phReading.className = "sensor-reading good";
        phStatus.textContent = "Good";
    } else {
        phReading.className = "sensor-reading bad";
        phStatus.textContent =
            sensorData.ph < currentPreset.phMin ? "Too Low" : "Too High";
    }

    // Update pump button
    const canPump = ppmGood && phGood && deviceOnline;
    pumpBtn.disabled = !canPump;

    if (canPump) {
        if (pumpActive) {
            pumpBtn.className = "pump-btn active";
            pumpBtn.textContent = "⏹️ Stop";
        } else {
            pumpBtn.className = "pump-btn ready";
            pumpBtn.textContent = "💧 Flow the water!";
        }
    } else {
        pumpBtn.className = "pump-btn";
        pumpBtn.textContent = "💧 Flow the water!";
    }
}

// Update pump UI
function updatePumpUI() {
    updateSensorUI(); // Refresh the entire UI to update pump button
}

// Toggle pump
function togglePump() {
    if (!deviceOnline) return;

    const newPumpState = !pumpActive;
    database.ref("/sensor/pump").set(newPumpState);
}

// Modal functions
function openModal(mode) {
    editingPreset = null;

    if (mode === "add") {
        modalTitle.textContent = "Add new preset";
        document.getElementById("deleteBtn").style.display = "none";
        presetForm.reset();
    } else if (mode === "edit" && currentPreset) {
        modalTitle.textContent = "Edit Preset";
        document.getElementById("deleteBtn").style.display = "block";
        editingPreset = presets.indexOf(currentPreset);

        // Fill form with current preset data
        document.getElementById("presetName").value = currentPreset.name;
        document.getElementById("ppmMin").value = currentPreset.ppmMin;
        document.getElementById("ppmMax").value = currentPreset.ppmMax;
        document.getElementById("phMin").value = currentPreset.phMin;
        document.getElementById("phMax").value = currentPreset.phMax;
    }

    presetModal.style.display = "block";
}

function closeModal() {
    presetModal.style.display = "none";
    presetForm.reset();
    editingPreset = null;
}

// Save preset
function savePreset(e) {
    e.preventDefault();

    const name = document.getElementById("presetName").value.trim();
    const ppmMin = parseInt(document.getElementById("ppmMin").value);
    const ppmMax = parseInt(document.getElementById("ppmMax").value);
    const phMin = parseFloat(document.getElementById("phMin").value);
    const phMax = parseFloat(document.getElementById("phMax").value);

    // Validation
    if (!name) {
        alert("Nama preset harus diisi");
        return;
    }

    if (ppmMin >= ppmMax) {
        alert("PPM Max harus lebih besar dari PPM Min");
        return;
    }

    if (phMin >= phMax || phMin < 0 || phMax > 14) {
        alert(
            "pH harus dalam range 0-14 dan pH Max harus lebih besar dari pH Min"
        );
        return;
    }

    const newPreset = { name, ppmMin, ppmMax, phMin, phMax };

    if (editingPreset !== null) {
        // Edit existing preset
        presets[editingPreset] = newPreset;
        currentPreset = newPreset;
    } else {
        // Add new preset
        presets.push(newPreset);
    }

    // Save to localStorage
    localStorage.setItem("waterPresets", JSON.stringify(presets));

    // Reload presets and close modal
    loadPresets();
    closeModal();

    // Select the newly added/edited preset
    if (editingPreset !== null) {
        presetSelect.value = editingPreset;
    } else {
        presetSelect.value = presets.length - 1;
        currentPreset = newPreset;
        editPresetBtn.disabled = false;
    }

    updateSensorUI();
}

// Delete preset
function deletePreset() {
    if (
        editingPreset !== null &&
        confirm("Apakah Anda yakin ingin menghapus preset ini?")
    ) {
        presets.splice(editingPreset, 1);
        localStorage.setItem("waterPresets", JSON.stringify(presets));

        // Reset selection
        currentPreset = null;
        presetSelect.value = "";
        editPresetBtn.disabled = true;

        loadPresets();
        closeModal();
        updateSensorUI();
    }
}

// Update UI periodically
function updateUI() {
    // Update status dot (sudah ada)
    setInterval(() => {
        if (deviceOnline) {
            const statusDot = document.querySelector(".status-dot");
            if (statusDot) {
                statusDot.style.animation = "blink 1.5s infinite";
            }
        }
    }, 1000);

    // Update device status text setiap detik agar "Terakhir Online" selalu update
    setInterval(() => {
        // Selalu update status device
        updateDeviceStatus();
    }, 1000);
}

// Initialize the application
initApp();

// For testing purposes - simulate data when Firebase is not configured
function simulateData() {
    // Simulate random sensor data for testing
    setInterval(() => {
        if (
            !firebase.apps.length ||
            !firebaseConfig.apiKey ||
            firebaseConfig.apiKey === "your-api-key"
        ) {
            // Simulate data only if Firebase is not properly configured
            sensorData.ppm = Math.floor(Math.random() * 1500) + 100;
            sensorData.ph = (Math.random() * 9 + 4).toFixed(1);
            deviceOnline = Math.random() > 0.1; // 90% chance of being online

            updateDeviceStatus();
            updateSensorUI();
        }
    }, 2000);
}

// Start simulation if Firebase is not configured
setTimeout(simulateData, 1000);

// Export functions for testing (optional)
window.waterMonitor = {
    setTestData: (ppm, ph, online = true) => {
        sensorData.ppm = ppm;
        sensorData.ph = ph;
        deviceOnline = online;
        updateDeviceStatus();
        updateSensorUI();
    },
    getCurrentPreset: () => currentPreset,
    getPresets: () => presets,
};
