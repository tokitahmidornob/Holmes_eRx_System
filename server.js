require('dotenv').config(); // 🛡️ Loads hidden environment variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet'); // 🛡️ HTTP Security headers
const rateLimit = require('express-rate-limit'); // 🛡️ API Traffic Control
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// --- ⚙️ 1. ENTERPRISE MIDDLEWARE & SECURITY ---
// Protects against known web vulnerabilities
app.use(helmet()); 

// Allows your Netlify frontend to talk to your Render backend securely
app.use(cors({
    origin: process.env.CLIENT_URL || '*', // We will lock this down to your Netlify URL later
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

// Parses incoming JSON, but limits size to 10MB to prevent payload crash attacks
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prevents brute-force attacks (Max 100 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: { success: false, error: "Traffic overload. Please try again later." }
});
app.use('/api/', apiLimiter);

// --- 🏛️ 2. THE IRON VAULT (DATABASE) ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/holmes_erx';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Iron Vault (MongoDB) Connected Successfully'))
    .catch((err) => {
        console.error('❌ Critical Vault Connection Error:', err);
        process.exit(1); // Commercial servers must shut down if DB fails, rather than run broken
    });

// --- 🚦 3. THE MODULAR ROUTING SYSTEM ---
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/patients', require('./backend/routes/patients'));
app.use('/api/doctors', require('./backend/routes/doctors'));
app.use('/api/pharmacists', require('./backend/routes/pharmacists'));
app.use('/api/medicines', require('./backend/routes/medicines'));
app.use('/api/prescriptions', require('./backend/routes/prescriptions'));

// --- ⚡ 4. REAL-TIME PHARMACIST QUEUE (WEBSOCKETS) ---
const io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || '*', methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log(`🔌 Secure Live Connection Established: ${socket.id}`);
    socket.on('disconnect', () => console.log(`🔌 Connection Lost: ${socket.id}`));
});

// Make 'io' globally accessible to your routes so they can broadcast updates
app.set('io', io);

// --- 🚨 5. GLOBAL ERROR CATCHER ---
// If any code fails, this prevents the entire server from crashing and sends a clean error to the frontend
app.use((err, req, res, next) => {
    console.error("🔥 System Exception:", err.stack);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// --- 🚀 6. SYSTEM IGNITION ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 HOLMES eRX MASTER ENGINE ONLINE`);
    console.log(`🛡️  Security: Active | Port: ${PORT}`);
    console.log(`=========================================`);
});