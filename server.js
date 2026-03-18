require('dotenv').config(); // Allows the app to read secret variables
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http'); 
const { Server } = require("socket.io"); 
const path = require('path');
const fs = require('fs');

// Import our newly organized routes!
const apiRoutes = require('./backend/routes/api');

const app = express();
// CRITICAL FIX: Use Render's assigned port, or 3000 if on your laptop
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 📡 WEBSOCKET BROADCASTER ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
    socket.on('call_patient', (data) => io.emit('queue_update', data));
});

// --- 🚀 MOUNT THE API ROUTES ---
// This tells the server to send all /api traffic to our new api.js file
app.use('/api', apiRoutes);

// --- 🗄️ THE IRON VAULT CONNECTION ---
// CRITICAL FIX: This tells the code to grab the key from Render's Secret Vault!
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => {
        console.log("\n=================================================");
        console.log(`✅ Iron Vault Connected: MongoDB Atlas is online.`);
        server.listen(PORT, () => {
            console.log(`🔍 eRx Modular Engine running on Port ${PORT}`);
            console.log(`⚡ Live WebSocket Broadcasting is ACTIVE`);
            console.log(`=================================================\n`);
        });
    })
    .catch(err => console.error("❌ Vault Connection Failed:", err));