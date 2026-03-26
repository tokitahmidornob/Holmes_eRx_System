const mongoose = require('mongoose');
const csv = require('csvtojson');
require('dotenv').config();

async function injectData() {
    console.log("🔍 Investigating Environment...");
    const uri = process.env.MONGO_URI;

    if (!uri) {
        console.error("❌ CRITICAL ERROR: MONGO_URI is missing or undefined.");
        process.exit(1);
    }

    try {
        console.log("🔗 Connecting to the Iron Vault (Cloud)...");
        await mongoose.connect(uri);
        console.log("✅ Connection Established.");

        // 🌟 USING THE PRE-CLEANED MASTER FILE 🌟
        const fileName = 'Holmes_Grid_Cleaned_Medicines.csv';

        console.log("⏳ Parsing the purified clinical CSV...");
        const medicines = await csv().fromFile(fileName);

        const MedicineCollection = mongoose.connection.collection('medicines');

        console.log(`📦 Preparing to inject ${medicines.length} verified records into the grid...`);
        
        // Wipe old data first to avoid duplicates
        await MedicineCollection.deleteMany({});
        console.log("🗑️ Vault cleared for fresh injection.");
        
        // 🚀 BATCH INJECTION (5,000 at a time for safety)
        const BATCH_SIZE = 5000;
        for (let i = 0; i < medicines.length; i += BATCH_SIZE) {
            const batch = medicines.slice(i, i + BATCH_SIZE);
            await MedicineCollection.insertMany(batch);
            console.log(`✅ Injected batch ${i} to ${i + batch.length}...`);
        }

        console.log("✨ SUCCESS: The Grand Pharmacy is now stocked with verified records!");
        process.exit(0);
    } catch (err) {
        console.error("❌ MISSION FAILED:", err.message);
        process.exit(1);
    }
}

injectData();