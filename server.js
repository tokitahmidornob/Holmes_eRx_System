require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http'); 
const { Server } = require("socket.io"); 
const path = require('path');
const fs = require('fs');

// --- 📂 IMPORT ROUTES ---
const patientRoutes = require('./backend/routes/patients');
const prescriptionRoutes = require('./backend/routes/prescriptions');

const app = express();
const PORT = process.env.PORT || 3000;

// --- ⚙️ MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Ensure 'uploads' directory exists
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

// --- 🗄️ THE LOCAL VAULT CONNECTION ---
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
    console.error("❌ CRITICAL ERROR: MONGO_URI is missing from the .env file.");
    process.exit(1);
}

mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 15000 
})
.then(() => {
    console.log("\n=================================================");
    console.log(`✅ Iron Vault Connected: Local MongoDB is online.`);
    
    server.listen(PORT, () => {
        console.log(`🔍 eRx Modular Engine running on Port ${PORT}`);
        console.log(`⚡ Live WebSocket Broadcasting is ACTIVE`);
        console.log(`=================================================\n`);
    });
})
.catch(err => {
    console.error("\n❌ Vault Connection Failed!");
    console.error(err);
});