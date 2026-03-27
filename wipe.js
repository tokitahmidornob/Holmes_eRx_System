const mongoose = require('mongoose');
const { Person, Patient, PractitionerRole, Prescription } = require('./models/GridModels');

// The Master Key is locked in.
const MONGO_URI = "mongodb+srv://tokitahmidornob_db_user:Holmes123@erx-central.rhc8rji.mongodb.net/holmes_erx?appName=eRx-Central";

async function executePurge() {
    try {
        console.log("Initiating connection to the National Grid...");
        await mongoose.connect(MONGO_URI);
        console.log("Connection established. Commencing data purge...");

        // 💥 Wipe the core identities and roles
        const personResult = await Person.deleteMany({});
        const patientResult = await Patient.deleteMany({});
        const roleResult = await PractitionerRole.deleteMany({});
        const rxResult = await Prescription.deleteMany({});

        console.log(`\n=== PURGE COMPLETE ===`);
        console.log(`- ${personResult.deletedCount} Core Identities Erased.`);
        console.log(`- ${patientResult.deletedCount} Citizen Profiles Erased.`);
        console.log(`- ${roleResult.deletedCount} Practitioner Authorities Erased.`);
        console.log(`- ${rxResult.deletedCount} Prescriptions Erased.`);
        
        console.log("\nThe Grid is perfectly clean. Exiting.");
        process.exit(0);
    } catch (err) {
        console.error("Purge Failed:", err);
        process.exit(1);
    }
}

executePurge();