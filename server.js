require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http'); 
const { Server } = require("socket.io"); 
const path = require('path');
const fs = require('fs');


const app = express();
const PORT = process.env.PORT || 3000;

// --- ⚙️ THE MAIL OPENERS (MIDDLEWARE) ---
// CRITICAL: These MUST come before your routes!
app.use(cors());
app.use(express.json()); // This parses the JSON you send from Thunder Client
app.use(express.urlencoded({ extended: true }));

// --- 📂 IMPORT ROUTES ---
const patientRoutes = require('./backend/routes/patients');
const prescriptionRoutes = require('./backend/routes/prescriptions');
const medicineRoutes = require('./backend/routes/medicines');

// Ensure 'uploads' folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 📡 WEBSOCKET ENGINE ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
    socket.on('call_patient', (data) => io.emit('queue_update', data));
});

// --- 🚀 MOUNTING THE API ROUTES ---
app.use('/api/patients', patientRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/medicines', medicineRoutes);

// --- 🗄️ THE LOCAL VAULT CONNECTION ---
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
.then(() => {
    console.log("\n=================================================");
    console.log(`✅ Local Vault Connected: Your PC is the host.`);
    
    server.listen(PORT, () => {
        console.log(`🔍 eRx Engine running on Port ${PORT}`);
        console.log(`⚡ WebSocket System: ONLINE`);
        console.log(`=================================================\n`);
    });
})
.catch(err => console.error("❌ Vault Connection Failed:", err));