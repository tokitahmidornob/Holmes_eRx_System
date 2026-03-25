require('dotenv').config();
const mongoose = require('mongoose');

// Import your user vault models
const Doctor = require('./backend/models/Doctor');
const Patient = require('./backend/models/Patient');
const Pharmacist = require('./backend/models/Pharmacist');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/holmes_erx';

async function ignitePurge() {
    try {
        console.log("🔌 Connecting to the Iron Vault...");
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected!\n");

        console.log("🧹 Initiating User Purge Protocol...");

        // Wipe the specific collections clean
        const docResult = await Doctor.deleteMany({});
        console.log(`🗑️  Erased ${docResult.deletedCount} Doctor records.`);

        const patResult = await Patient.deleteMany({});
        console.log(`🗑️  Erased ${patResult.deletedCount} Patient records.`);

        const pharmResult = await Pharmacist.deleteMany({});
        console.log(`🗑️  Erased ${pharmResult.deletedCount} Pharmacist records.`);

        console.log("\n✨ PURGE COMPLETE! The user vaults are completely empty.");
        console.log("Your Medicine database remains perfectly safe.");
        process.exit();
    } catch (error) {
        console.error("🔥 Purge Failed:", error);
        process.exit(1);
    }
}

ignitePurge();