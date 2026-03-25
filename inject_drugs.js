require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const Medicine = require('./backend/models/Medicine'); 

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/holmes_erx';

async function igniteInjection() {
    try {
        console.log("🔌 Connecting to the Iron Vault...");
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected!");

        console.log("📖 Reading purified JSON file...");
        const rawData = fs.readFileSync('Holmes_Master_Import.json', 'utf-8');
        const drugsArray = JSON.parse(rawData);

        console.log(`⚠️ Injecting ${drugsArray.length} medications. DO NOT close the terminal...`);
        
        // Wipe the old medicine vault clean just in case you had test data
        await Medicine.deleteMany({}); 
        
        // The Grand Injection
        await Medicine.insertMany(drugsArray);

        console.log("🚀 INJECTION COMPLETE! Your Drug Engine is now fully armed.");
        process.exit();
    } catch (error) {
        console.error("🔥 Injection Failed:", error);
        process.exit(1);
    }
}

igniteInjection();