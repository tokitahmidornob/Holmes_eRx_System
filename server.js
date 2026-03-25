const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// DATABASE CONNECTION
// This covers both MONGO_URI and the older MONGO_URT typo just in case
const dbUri = process.env.MONGO_URI || process.env.MONGO_URT;
mongoose.connect(dbUri)
    .then(() => console.log('✅ Iron Vault (MongoDB) Connected Successfully'))
    .catch(err => console.error('❌ Database Connection Failed:', err));

// HEALTH CHECK (The "Dial Tone" test)
app.get('/', (req, res) => {
    res.status(200).send("🚀 National Grid Online and Operational.");
});

// ==========================================
// 🛰️ MASTER ROUTE CONTROLLER
// ==========================================
// These paths assume the "routes" folder is in the same folder as this server.js
app.use('/api/auth', require('./routes/auth'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/medicines', require('./routes/medicines'));

// ==========================================
// 🗼 RENDER DEPLOYMENT BINDING
// ==========================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    =========================================
    🚀 HOLMES eRx ENGINE IS LIVE
    📡 Listening on Port: ${PORT}
    🌐 Binding Address: 0.0.0.0 (Global)
    =========================================
    `);
});