const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
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

// ROUTES (Points to the folders you just moved to the root)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/labs', require('./routes/labs'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Master Engine is LIVE on port: ${PORT}`);
});