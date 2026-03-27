const mongoose = require('mongoose');

// ==========================================
// 0. UNIVERSAL AUDIT METADATA
// ==========================================
const AuditMetadata = {
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    lastModifiedBy: { type: String },
    lastModifiedAt: { type: Date, default: Date.now },
    verificationStatus: { type: String, default: 'Pending' }
};

// ==========================================
// 1. CORE IDENTITY (Person)
// ==========================================
const PersonSchema = new mongoose.Schema({
    loginIdentity: { type: String, required: true, unique: true }, // Auto-indexed
    passwordHash: { type: String, required: true },
    legalFullName: { type: String, required: true },
    genderLegal: { type: String },
    dateOfBirth: { type: Date },
    contact: {
        primaryMobile: { type: String, default: '0000000000' },
        primaryEmail: { type: String }
    },
    audit: AuditMetadata
});

// ==========================================
// 2. CLINICAL ACTORS (Patient & Practitioner)
// ==========================================
const PatientSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    nationalHealthId: { type: String, unique: true }, // Auto-indexed
    nationalId: { type: String, unique: true, sparse: true }, // Auto-indexed
    bloodGroup: { type: String },
    audit: AuditMetadata
});

const PractitionerRoleSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    roleType: { type: String, enum: ['Doctor', 'Pharmacist', 'Nurse', 'Admin'], required: true },
    licenseNumber: { type: String, unique: true, sparse: true }, // Auto-indexed
    specialty: [{ type: String }],
    audit: AuditMetadata
});

// ==========================================
// 3. THE CRYPTOGRAPHIC PAYLOAD (Prescription)
// ==========================================
const PrescriptionSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    practitionerRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'PractitionerRole', required: true },
    broadcastId: { type: String, required: true, unique: true }, // Auto-indexed
    otp: { type: String, required: true },
    medications: [{
        brandName: String,
        dosage: String,
        timing: String,
        duration: String
    }],
    investigations: [{ type: String }],
    status: { type: String, enum: ['Active', 'Dispensed', 'Revoked'], default: 'Active' },
    createdAt: { type: Date, default: Date.now }
});

// ==========================================
// 4. CLINICAL DOSSIER (Allergies & Meds)
// ==========================================
const AllergyProfileSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    substance: { type: String, required: true },
    criticality: { type: String, enum: ['Low', 'High', 'Unknown'], default: 'Unknown' },
    verificationStatus: { type: String, enum: ['Unconfirmed', 'Confirmed', 'Refuted'], default: 'Unconfirmed' },
    audit: AuditMetadata
});

const MedicationProfileSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    brandName: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Completed', 'Stopped'], default: 'Active' },
    audit: AuditMetadata
});

// ==========================================
// 5. INFRASTRUCTURE & LABS
// ==========================================
const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String },
    audit: AuditMetadata
});

const LocationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String },
    audit: AuditMetadata
});

const CredentialSchema = new mongoose.Schema({
    practitionerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PractitionerRole' },
    qualification: { type: String },
    audit: AuditMetadata
});

const LabProfileSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    testName: { type: String },
    result: { type: String },
    audit: AuditMetadata
});

// ==========================================
// 6. CONSENT & AUDIT EVENT (Immutable)
// ==========================================
const ConsentSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    scope: { type: String, enum: ['Data_Sharing', 'Treatment', 'Research'] },
    status: { type: String, enum: ['Active', 'Revoked', 'Pending'] },
    dateTime: { type: Date, default: Date.now },
    audit: AuditMetadata
});

const AuditEventSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now, immutable: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    actionType: { type: String, required: true }, 
    resourceType: { type: String }, 
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    ipAddress: { type: String, required: true },
    deviceMetadata: { type: String },
    outcome: { type: String, enum: ['Success', 'Failure', 'Warning'] },
    provenanceHash: { type: String, required: true } 
}, { capped: { size: 1073741824 } }); 

// ==========================================
// 🚀 HYPER-SCALING B-TREE INDEXES (CLEANED)
// ==========================================
// Note: loginIdentity, nationalHealthId, nationalId, licenseNumber, and broadcastId 
// are already indexed automatically via 'unique: true' in their schemas above.

// 1. Relational Lookups (Instantly find a Patient profile from a Person ID)
PatientSchema.index({ personId: 1 });
PractitionerRoleSchema.index({ personId: 1 });

// 2. Cryptographic Payload Lookups (Instantly find prescriptions for Pharmacy & Patient Vaults)
PrescriptionSchema.index({ patientId: 1, createdAt: -1 }); 
PrescriptionSchema.index({ practitionerRoleId: 1, createdAt: -1 }); 

// 3. Clinical Dossier Lookups (Instantly load Allergies/Meds for the Contraindication Engine)
AllergyProfileSchema.index({ patientId: 1 });
MedicationProfileSchema.index({ patientId: 1 });


// ==========================================
// 🏁 MASTER EXPORTS
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
    AuditEvent: mongoose.model('AuditEvent', AuditEventSchema)
};