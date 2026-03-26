const mongoose = require('mongoose');

// ==========================================
// 1. CROSS-CUTTING AUDIT & METADATA
// ==========================================
const AuditMetadata = {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    lastPermissionChange: { type: Date },
    verificationStatus: { type: String, enum: ['Verified', 'Pending', 'Rejected', 'Unverified'], default: 'Unverified' },
    sourceOfTruth: { type: String, default: 'Self-Reported' },
    softDeleted: { type: Boolean, default: false },
    breachFlag: { type: Boolean, default: false }
};

// ==========================================
// 2. THE PERSON (Universal Identity)
// ==========================================
const PersonSchema = new mongoose.Schema({
    internalUuid: { type: String, required: true, unique: true },
    loginIdentity: { type: String, required: true, unique: true }, // Email or SSO
    password: { type: String, required: true },
    
    legalFullName: { type: String, required: true },
    displayName: { type: String },
    preferredName: { type: String },
    dateOfBirth: { type: Date },
    genderLegal: { type: String }, // As required by local law
    nationalId: { type: String }, // NID / Passport
    
    contact: {
        primaryMobile: { type: String },
        primaryEmail: { type: String },
        address: { type: String }
    },
    
    preferences: {
        preferredLanguage: { type: String, default: 'en-US' },
        locale: { type: String, default: 'BD' }
    },
    
    security: {
        accountStatus: { type: String, enum: ['Active', 'Suspended', 'Terminated', 'Pending Verification'], default: 'Pending Verification' },
        mfaEnabled: { type: Boolean, default: false },
        portalIdentityVerificationStatus: { type: String, enum: ['Level 1', 'Level 2', 'Level 3 (Biometric)'], default: 'Level 1' },
        fraudExceptionFlags: [{ type: String }]
    },
    
    audit: AuditMetadata
}, { timestamps: true });

// ==========================================
// 3. ORGANIZATION & LOCATION
// ==========================================
const OrganizationSchema = new mongoose.Schema({
    orgType: { type: String, enum: ['Hospital', 'Clinic', 'Pharmacy', 'Laboratory'] },
    orgName: { type: String, required: true },
    legalIdentifiers: {
        tradeLicense: { type: String },
        cliaCertificate: { type: String }, // Or local equivalent
        pharmacyCouncilId: { type: String }
    },
    certificateValidity: {
        issuedDate: { type: Date },
        expiryDate: { type: Date }
    },
    contactChannels: { phone: String, email: String, website: String },
    directors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
    supportedTestMenu: [{ type: String }], // For Labs
    audit: AuditMetadata
});

const LocationSchema = new mongoose.Schema({
    managingOrganization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    locationName: { type: String },
    physicalAddress: { type: String },
    operatingHours: { type: String },
    audit: AuditMetadata
});

// ==========================================
// 4. PROFESSIONAL CREDENTIALS (Immutable proofs)
// ==========================================
const CredentialSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    credentialType: { type: String, enum: ['Medical License', 'Pharmacy License', 'Pathology Board', 'DEA/Narcotics'] },
    licenseNumber: { type: String, required: true },
    issuingAuthority: { type: String, required: true },
    jurisdiction: { type: String },
    effectiveDate: { type: Date },
    expiryDate: { type: Date },
    documentAttachmentUrl: { type: String }, // Link to cloud bucket
    verificationStatus: { type: String, enum: ['Verified', 'Pending', 'Expired', 'Revoked'] },
    audit: AuditMetadata
});

// ==========================================
// 5. PRACTITIONER ROLE (Authority & Scopes)
// ==========================================
const PractitionerRoleSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    locationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],
    
    roleType: { type: String, enum: ['Doctor', 'Pharmacist', 'Pathologist'], required: true },
    
    // Doctor Specifics
    doctorScopes: {
        specialty: { type: String },
        subSpecialty: { type: String },
        providerIdentifierNPI: { type: String },
        consultationModes: [{ type: String, enum: ['In-Person', 'Telemedicine', 'Home Care'] }],
        prescriptionAuthorityScope: [{ type: String }],
        controlledSubstanceAuthority: { type: Boolean, default: false },
        epcsIdentityProofingStatus: { type: Boolean, default: false },
        twoFactorSigningEnabled: { type: Boolean, default: false },
        supervisingPhysicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
        formularyPreferences: [{ type: String }],
        signatureBlockMetadata: { type: String }
    },
    
    // Pharmacist Specifics
    pharmacistScopes: {
        pharmacyRole: { type: String, enum: ['Staff', 'Verifying', 'PIC', 'Owner', 'Trainee'] },
        shiftAssignment: { type: String },
        substitutionAuthority: { type: Boolean, default: false },
        controlledSubstanceProcessing: { type: Boolean, default: false },
        verificationFinalCheck: { type: Boolean, default: false },
        immunizationAuthority: { type: Boolean, default: false },
        counselingPermissions: { type: Boolean, default: true },
        suspensionRestrictionFlags: [{ type: String }]
    },
    
    // Pathologist Specifics
    pathologistScopes: {
        boardCertificationDetails: { type: String },
        signOutPrivileges: { type: Boolean, default: false },
        testCategoryPermissions: [{ type: String }],
        specimenAuthorizationLevel: { type: String },
        consultationPrivileges: { type: Boolean, default: false },
        digitalReportSigningStatus: { type: Boolean, default: false },
        escalationSettings: { type: String },
        onCallStatus: { type: Boolean, default: false }
    },
    
    audit: AuditMetadata
});

// ==========================================
// 6. PATIENT (Safety & Clinical Anchors)
// ==========================================
const PatientSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true, unique: true },
    enterpriseMrn: { type: String, unique: true },
    nationalHealthId: { type: String },
    
    deceasedFlag: { type: Boolean, default: false },
    
    emergencyContact: {
        name: { type: String },
        relation: { type: String },
        phone: { type: String }
    },
    
    careTeam: {
        caregiverGuardian: { type: String },
        primaryDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
        preferredPharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }
    },
    
    financials: {
        insuranceIdentifiers: [{ type: String }],
        payerMembershipDetails: { type: String }
    },
    
    privacyAndConsent: {
        communicationPreferences: [{ type: String }],
        consentFlags: [{ type: String }],
        mergeDuplicateStatus: { type: String }
    },
    
    // Safety-Critical Links (These would ideally be their own collections in FHIR, referenced here for strict safety checks)
    // Safety-Critical Links 
    safetyAnchors: {
        bloodGroup: { type: String },
        knownAllergies: [{ type: String }],
        chronicConditions: [{ type: String }],
        surgeryHistory: [{
            surgeryName: String,
            surgeonName: String,
            hospitalName: String,
            approximateDate: String
        }],
        pregnancyLactationStatus: { type: String },
        pediatricDosingContext: { type: String }
    },
    
    audit: AuditMetadata
});

// ==========================================
// 7. AUDIT EVENT (Immutable Security Log)
// ==========================================
const AuditEventSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now, immutable: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', immutable: true },
    actionType: { type: String, required: true, immutable: true }, // e.g., 'PRESCRIPTION_SIGNED', 'LOGIN_FAILED'
    resourceType: { type: String, immutable: true }, // e.g., 'MedicationProfile', 'Patient'
    resourceId: { type: mongoose.Schema.Types.ObjectId, immutable: true },
    ipAddress: { type: String, immutable: true },
    deviceMetadata: { type: String, immutable: true },
    outcome: { type: String, enum: ['Success', 'Failure', 'Warning'], immutable: true },
    dataProvenanceHash: { type: String, immutable: true } // Cryptographic hash of the action
});

module.exports = {
    Person: mongoose.model('Person', PersonSchema),
    Organization: mongoose.model('Organization', OrganizationSchema),
    Location: mongoose.model('Location', LocationSchema),
    Credential: mongoose.model('Credential', CredentialSchema),
    PractitionerRole: mongoose.model('PractitionerRole', PractitionerRoleSchema),
    Patient: mongoose.model('Patient', PatientSchema),
    AuditEvent: mongoose.model('AuditEvent', AuditEventSchema)
};