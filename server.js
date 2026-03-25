const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. GLOBAL MIDDLEWARE
app.use(cors());
app.use(express.json());

// 2. THE RENDER HEALTH CHECK (Crucial for Deployment)
app.get('/', (req, res) => {
    res.status(200).send("🚀 National Grid Online and Operational.");
});

// 3. IRON VAULT CONNECTION
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Iron Vault (MongoDB) Connected Successfully"))
    .catch(err => console.error("❌ Vault Connection Error:", err));

// 4. GRID ROUTE SYNAPSES
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/medicines', require('./backend/routes/medicines'));
app.use('/api/prescriptions', require('./backend/routes/prescriptions'));
app.use('/api/doctors', require('./backend/routes/doctors'));
app.use('/api/appointments', require('./backend/routes/appointments'));
app.use('/api/patients', require('./backend/routes/patients'));
app.use('/api/labs', require('./backend/routes/labs'));

// 5. HIGH-AVAILABILITY PORT BINDING
// Render provides process.env.PORT. We MUST bind it to '0.0.0.0' so the external scanner can see it.
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Master Engine is LIVE and bound to port: ${PORT}`);
});
