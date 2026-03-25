const mongoose = require('mongoose');
require('dotenv').config();

async function peekIntoVault() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("🔗 Connected to Iron Vault...");
        
        // Grab just ONE record to inspect its DNA
        const oneMedicine = await mongoose.connection.collection('medicines').findOne({});
        
        console.log("\n🔍 FIRST RECORD FOUND:");
        console.log(oneMedicine);
        
        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
}

peekIntoVault();