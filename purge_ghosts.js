require('dotenv').config();
const mongoose = require('mongoose');
const { Prescription } = require('./models/GridModels');

async function purgeGhosts() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected");

        const result = await Prescription.deleteMany({});
        console.log(`Deleted ${result.deletedCount} old prescription ghosts.`);
        console.log("All old prescriptions successfully purged.");

    } catch (err) {
        console.error("Purge Failed:", err);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
}

purgeGhosts();
