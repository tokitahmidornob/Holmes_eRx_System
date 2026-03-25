const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

async function injectData() {
    // --- 🕵️ PRE-FLIGHT ENVIRONMENT CHECK ---
    console.log("🔍 Investigating Environment...");
    const uri = process.env.MONGO_URI;

    if (!uri) {
        console.error("❌ CRITICAL ERROR: MONGO_URI is missing or undefined.");
        console.log("Current Directory:", __dirname);
        console.log("Tip: Ensure your file is named exactly '.env' and NOT '.env.txt'");
        process.exit(1);
    }

    try {
        console.log("🔗 Connecting to the Iron Vault (Cloud)...");
        await mongoose.connect(uri);
        console.log("✅ Connection Established.");

        // Read the purified medicine list
        const fileName = 'Holmes_Master_Import.json';
        if (!fs.existsSync(fileName)) {
            console.error(`❌ ERROR: ${fileName} not found in this folder!`);
            process.exit(1);
        }

        const rawData = fs.readFileSync(fileName);
        const medicines = JSON.parse(rawData);

        // Access the 'medicines' collection directly
        const MedicineCollection = mongoose.connection.collection('medicines');

        console.log(`📦 Preparing to inject ${medicines.length} records into the grid...`);
        
        // Wipe old data first to avoid duplicates
        await MedicineCollection.deleteMany({});
        
        // Perform the mass injection
        await MedicineCollection.insertMany(medicines);

        console.log("✨ SUCCESS: The Grand Pharmacy is now stocked and online!");
        process.exit(0);
    } catch (err) {
        console.error("❌ MISSION FAILED:", err.message);
        process.exit(1);
    }
}

injectData();