const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const orgRoutes = require('./routes/organizations');
const credentialRoutes = require('./routes/credentials');
const affiliationRoutes = require('./routes/affiliation');
const patientRoutes = require('./routes/patients');
const clinicalRoutes = require('./routes/clinical');
const prescriptionRoutes = require('./routes/prescriptions');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI || process.env.MONGO_URT)
    .then(() => console.log('✅ Iron Vault (MongoDB) Connected Successfully'))
    .catch(err => console.error('❌ Database Connection Failed:', err));

app.get('/', (req, res) => {
    res.status(200).send("🚀 National Grid Online and Operational.");
});
const { logAudit } = require('./middleware/auditLogger.js');


// ... other middlewares (cors, json, etc)

// Plug in the 'Black Box' Recorder
app.use(logAudit);

// ... your routes (api/auth, api/profile, etc)

// ROUTES (Points to the folders you just moved to the root)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/labs', require('./routes/labs'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/organizations', orgRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/affiliation', affiliationRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/clinical', clinicalRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/pharmacy', require('./routes/pharmacy'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/patient', require('./routes/patient'));
app.use('/api/clinical', require('./routes/clinical'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Master Engine is LIVE on port: ${PORT}`);
});