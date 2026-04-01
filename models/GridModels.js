const mongoose = require('mongoose');

// ==========================================
// 1. CORE IDENTITY (Upgraded with Grid ID)
// ==========================================
const PersonSchema = new mongoose.Schema({
    gridId: { type: String, unique: true, sparse: true }, // 🚨 The new Auto-ID System
    loginIdentity: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    legalFullName: { type: String, required: true },
    contact: {
        primaryEmail: { type: String },
        primaryMobile: { type: String, default: '0000000000' }
    },
    dateOfBirth: { type: Date },
    genderLegal: { type: String, enum: ['Male', 'Female', 'Other'] }
}, { timestamps: true });

// ==========================================
// 2. PATIENT (CITIZEN) PROFILE
// ==========================================
const PatientSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    nationalHealthId: { type: String, unique: true, sparse: true },
    nationalId: { type: String, unique: true, sparse: true },
    bloodGroup: { type: String }
}, { timestamps: true });

// ==========================================
// 3. PRACTITIONER (AUTHORITY) PROFILE
// ==========================================
const PractitionerRoleSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    roleType: { type: String, enum: ['Doctor', 'Pharmacist', 'Pathologist', 'Admin'], required: true },
    licenseNumber: { type: String },
    specialty: [{ type: String }]
}, { timestamps: true });

// ==========================================
// 4. CLINICAL DOSSIER: ALLERGIES
// ==========================================
const AllergyProfileSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    substance: { type: String, required: true },
    criticality: { type: String, enum: ['Low', 'Moderate', 'High', 'Unknown'], default: 'Unknown' },
    verificationStatus: { type: String, default: 'Unconfirmed' }
}, { timestamps: true });

// ==========================================
// 5. THE FORMULARY (LIVE MEDICINE DATABASE)
// ==========================================
const MedicineSchema = new mongoose.Schema({
    brandName: { type: String, required: true },
    genericName: { type: String },
    strength: { type: String },
    form: { type: String }
}, { collection: 'medicines' }); // 🚨 Connects to your existing MongoDB collection

const Medicine = mongoose.model('Medicine', MedicineSchema);

// ==========================================
// 6. CRYPTOGRAPHIC PRESCRIPTION PAYLOAD
// ==========================================
const PrescriptionSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    practitionerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PractitionerRole' },
    medications: [{
        brandName: String,
        dosage: String,
        timing: String,
        duration: String
    }],
    investigations: [{ type: String }],
    broadcastId: { type: String, unique: true },
    otp: { type: String },
    status: { type: String, enum: ['Active', 'Dispensed', 'Revoked'], default: 'Active' }
}, { timestamps: true });

// ==========================================
// 7. STRUCTURAL PLACEHOLDER SCHEMAS
// ==========================================
const OrganizationSchema = new mongoose.Schema({ name: String });
const LocationSchema = new mongoose.Schema({ name: String });
const CredentialSchema = new mongoose.Schema({ title: String });
const MedicationProfileSchema = new mongoose.Schema({ patientId: String });
const LabProfileSchema = new mongoose.Schema({ patientId: String });
const ConsentSchema = new mongoose.Schema({ patientId: String });
const AuditEventSchema = new mongoose.Schema({ action: String });

// ==========================================
// 🚀 MASTER EXPORTS
// ==========================================
module.exports = {
    Person: mongoose.model('Person', PersonSchema),
    Organization: mongoose.model('Organization', OrganizationSchema),
    Location: mongoose.model('Location', LocationSchema),
    Credential: mongoose.model('Credential', CredentialSchema),
    PractitionerRole: mongoose.model('PractitionerRole', PractitionerRoleSchema),
    Prescription: mongoose.model('Prescription', PrescriptionSchema),
    Patient: mongoose.model('Patient', PatientSchema),
    AllergyProfile: mongoose.model('AllergyProfile', AllergyProfileSchema),
    MedicationProfile: mongoose.model('MedicationProfile', MedicationProfileSchema),
    LabProfile: mongoose.model('LabProfile', LabProfileSchema),
    Consent: mongoose.model('Consent', ConsentSchema),
    AuditEvent: mongoose.model('AuditEvent', AuditEventSchema),
    Medicine, // 🚨 Successfully exported
    User: mongoose.model('Person')
};