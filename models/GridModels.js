const mongoose = require('mongoose');

// ==========================================
// 🛡️ CROSS-CUTTING AUDIT & PROVENANCE
// ==========================================
const AuditMetadata = {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    lastPermissionChange: { type: Date },
    verificationStatus: { type: String, enum: ['Verified', 'Pending', 'Rejected', 'Unverified'], default: 'Unverified' },
    sourceOfTruth: { type: String, required: true, default: 'National_Identity_Server' },
    softDeleted: { type: Boolean, default: false },
    version: { type: Number, default: 1 }
};

// ==========================================
// 1. PERSON (The Human Identity)
// ==========================================
const PersonSchema = new mongoose.Schema({
    internalUuid: { type: String, required: true, unique: true }, // National UUID
    loginIdentity: { type: String, required: true, unique: true }, // SSO/Email
    password: { type: String, required: true }, // Hashed
    
    legalFullName: { type: String, required: true },
    displayName: { type: String },
    dateOfBirth: { type: Date, required: true },
    genderLegal: { type: String, required: true }, // Compliant with local laws
    nationalId: { type: String, unique: true }, // NID
    professionalPhotoUrl: { type: String },
    
    contact: {
        primaryMobile: { type: String, required: true },
        primaryEmail: { type: String, required: true },
        permanentAddress: { type: String }
    },
    
    locale: { lang: { type: String, default: 'bn-BD' }, timezone: String },
    
    security: {
        accountStatus: { type: String, enum: ['Active', 'Suspended', 'Terminated', 'Pending'], default: 'Pending' },
        mfaEnabled: { type: Boolean, default: false },
        securityIncidentFlags: [{ type: String }]
    },
    
    audit: AuditMetadata
}, { timestamps: true });

// ==========================================
// 2. ORGANIZATION & 3. LOCATION
// ==========================================
const OrganizationSchema = new mongoose.Schema({
    orgIdentifier: { type: String, unique: true }, // DGHS Org ID
    orgName: { type: String, required: true },
    orgType: { type: String, enum: ['Hospital', 'Clinic', 'Pharmacy', 'Laboratory'] },
    taxId: { type: String }, // BIN/TIN
    operatingHours: { type: String },
    contactChannels: { phone: String, email: String },
    labDirector: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' }, // Specifically for labs
    audit: AuditMetadata
});

const LocationSchema = new mongoose.Schema({
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    siteId: { type: String, unique: true },
    physicalAddress: { type: String, required: true },
    gpsCoordinates: { lat: Number, lng: Number },
    audit: AuditMetadata
});

// ==========================================
// 4. PROFESSIONAL CREDENTIAL
// ==========================================
const CredentialSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    credentialType: { type: String, enum: ['Medical_License', 'Pharmacy_License', 'Pathology_Board', 'Narcotics_Authority'] },
    licenseNumber: { type: String, required: true },
    issuingAuthority: { type: String, required: true }, // e.g., BMDC
    jurisdiction: { type: String, default: 'Bangladesh' },
    effectiveDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    documentAttachmentUrl: { type: String }, // Proof of certificate
    audit: AuditMetadata
});

// ==========================================
// 5. PRACTITIONER ROLE
// ==========================================
const PractitionerRoleSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    locationAssignments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
    
    specialty: { type: String },
    subSpecialty: { type: String },
    prescribingAuthorityScope: [{ type: String }], // e.g., 'General', 'Psychotropic'
    
    // Controlled Substance Protocols
    narcoticsRegistrationNumber: { type: String },
    epcsIdentityProofed: { type: Boolean, default: false },
    twoFactorSigningRequired: { type: Boolean, default: true },
    
    audit: AuditMetadata
});

// ==========================================
// 6. PATIENT (The Beneficiary)
// ==========================================
const PatientSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    enterpriseMrn: { type: String, unique: true }, // Hospital Internal ID
    nationalHealthId: { type: String, unique: true },
    
    emergencyContact: { name: String, relation: String, phone: String },
    caregiverGuardian: { name: String, phone: String },
    
    insuranceDetails: { payerName: String, membershipId: String },
    preferredPharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    primaryDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    
    deceasedFlag: { type: Boolean, default: false },
    audit: AuditMetadata
});

// ==========================================
// 7. CLINICAL VAULTS (Safety Critical)
// ==========================================
const AllergyProfileSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    substance: { type: String, required: true },
    criticality: { type: String, enum: ['Low', 'High', 'Unable_to_Assess'] },
    verificationStatus: { type: String, default: 'Unconfirmed' },
    audit: AuditMetadata
});

const MedicationProfileSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    brandName: String,
    genericName: String,
    status: { type: String, enum: ['Active', 'Completed', 'Discontinued'] },
    authoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PractitionerRole' },
    audit: AuditMetadata
});

const LabProfileSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
    testName: String,
    loincCode: String,
    resultValue: String,
    unit: String,
    labSite: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    audit: AuditMetadata
});

// ==========================================
// 7.5 E-PRESCRIBING PAYLOAD (The Broadcast)
// ==========================================
const PrescriptionSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    practitionerRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'PractitionerRole', required: true },
    broadcastId: { type: String, required: true, unique: true }, // e.g., RX-2026-ABC12
    otp: { type: String, required: true }, // 6-digit cryptographic unlock key
    
    medications: [{
        brandName: String,
        dosage: String,
        timing: String,
        duration: String
    }],
    investigations: [{ type: String }],
    
    status: { type: String, enum: ['Active', 'Dispensed', 'Revoked'], default: 'Active' },
    audit: AuditMetadata
}, { timestamps: true });

// ==========================================
// 8. CONSENT & 9. AUDIT EVENT (Immutable)
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
    actionType: { type: String, required: true }, // e.g., 'RX_SIGN', 'DATA_ACCESS'
    resourceType: { type: String }, // e.g., 'Patient', 'Allergy'
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    ipAddress: { type: String, required: true },
    deviceMetadata: { type: String },
    outcome: { type: String, enum: ['Success', 'Failure', 'Warning'] },
    provenanceHash: { type: String, required: true } // Cryptographic seal
}, { capped: { size: 1073741824 } }); // Capped at 1GB for high-speed audit logging

// ==========================================
// 🚀 HYPER-SCALING B-TREE INDEXES
// ==========================================

// 1. Identity Lookups (Lightning fast logins and MPI searches)
PersonSchema.index({ loginIdentity: 1 }, { unique: true });
PatientSchema.index({ nationalHealthId: 1 });
PatientSchema.index({ nationalId: 1 });
PractitionerRoleSchema.index({ licenseNumber: 1 });

// 2. Relational Lookups (Instantly find a Patient profile from a Person ID)
PatientSchema.index({ personId: 1 });
PractitionerRoleSchema.index({ personId: 1 });

// 3. Cryptographic Payload Lookups (Instantly find prescriptions for Pharmacy & Patient Vaults)
PrescriptionSchema.index({ broadcastId: 1 }, { unique: true });
PrescriptionSchema.index({ patientId: 1, createdAt: -1 }); // Compound index for Vault sorting
PrescriptionSchema.index({ practitionerRoleId: 1, createdAt: -1 }); 

// 4. Clinical Dossier Lookups (Instantly load Allergies/Meds for the Contraindication Engine)
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
    Patient: mongoose.model('Patient', PatientSchema),
    AllergyProfile: mongoose.model('AllergyProfile', AllergyProfileSchema),
    MedicationProfile: mongoose.model('MedicationProfile', MedicationProfileSchema),
    LabProfile: mongoose.model('LabProfile', LabProfileSchema),
    Consent: mongoose.model('Consent', ConsentSchema),
    AuditEvent: mongoose.model('AuditEvent', AuditEventSchema)
};