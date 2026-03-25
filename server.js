const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// Load Environment Variables
dotenv.config();

const app = express();

// Core Middleware
app.use(express.json());
app.use(cors());

// ==========================================
// 1. FRONTEND SERVING LOGIC (The Master Stroke)
// ==========================================
// Serve all static files (CSS, JS, Images, HTML) from the 'frontend' folder
app.use(express.static(path.join(__dirname, 'frontend')));

// ==========================================
// 2. API ROUTES (The Internal Wiring)
// ==========================================
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/prescriptions', require('./backend/routes/prescriptions'));
app.use('/api/patients', require('./backend/routes/patients'));
app.use('/api/doctors', require('./backend/routes/doctors'));
app.use('/api/medicines', require('./backend/routes/medicines'));
app.use('/api/pharmacists', require('./backend/routes/pharmacists'));
app.use('/api/analytics', require('./backend/routes/analytics'));
app.use('/api/appointments', require('./backend/routes/appointments'));


// ==========================================
// 3. MAIN GATEWAY ROUTER
// ==========================================
// If a user visits the root web address, send them to the Gateway
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ==========================================
// 4. IRON VAULT DATABASE CONNECTION
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Iron Vault (MongoDB) Connected Successfully'))
    .catch((error) => console.error('🔥 Vault Connection Failed:', error.message));

// ==========================================
// 5. IGNITION
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Master Engine running on port ${PORT}`);
});