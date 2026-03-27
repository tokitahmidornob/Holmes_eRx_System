const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        // 🚨 Using your specific Render Environment Variable names
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendPrescriptionEmail = async (patientEmail, broadcastId, otp, doctorName) => {
    try {
        const mailOptions = {
            from: `"Holmes National Grid" <${process.env.EMAIL_USER}>`,
            to: patientEmail,
            subject: '🔒 Secure Grid Payload: Your Prescription OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #0f172a; margin: 0; font-size: 24px;">Holmes National Grid</h2>
                        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Encrypted Medical Payload</p>
                    </div>
                    
                    <p style="color: #475569; text-align: center; line-height: 1.6;">A new prescription has been securely broadcasted to your identity by <strong>Dr. ${doctorName}</strong>.</p>
                    
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px dashed #cbd5e1;">
                        <p style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Grid Broadcast ID</p>
                        <p style="font-size: 20px; font-weight: bold; color: #0f172a; margin: 0;">${broadcastId}</p>
                    </div>
                    
                    <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 1px solid #a7f3d0;">
                        <p style="font-size: 12px; color: #059669; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Decryption OTP</p>
                        <p style="font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 8px; margin: 0;">${otp}</p>
                    </div>
                    
                    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; line-height: 1.5;">Present this Broadcast ID and OTP to any authorized Grid Pharmacy to decrypt and dispense your medication. Do not share this OTP with unauthorized personnel.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[GRID TELEMETRY] Secure email dispatched to ${patientEmail}`);
    } catch (error) {
        console.error("EMAIL_GATEWAY_ERROR:", error);
    }
};

module.exports = { sendPrescriptionEmail };