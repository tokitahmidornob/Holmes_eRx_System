require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Person, Patient, PractitionerRole } = require('./models/GridModels');
const User = require('./models/User');

const DEMO_PASSWORD = '12345678';
const SALT_ROUNDS = 10;

const actors = [
    {
        role: 'ministry',
        email: 'director@intelliscript.bd',
        fullName: 'Ministry Director',
        loginIdentity: 'director@intelliscript.bd',
        gridId: 'GRID-MIN-0001',
        contact: {
            primaryEmail: 'director@intelliscript.bd',
            primaryMobile: '+8801700000001',
            address: 'Ministry of Health HQ',
            languagePref: 'English'
        },
        dateOfBirth: new Date('1980-01-01'),
        genderLegal: 'Other',
        practitioner: false
    },
    {
        role: 'doctor',
        email: 'doctor@intelliscript.bd',
        fullName: 'Dr. Ayesha Rahman',
        loginIdentity: 'doctor@intelliscript.bd',
        gridId: 'GRID-DR-0001',
        contact: {
            primaryEmail: 'doctor@intelliscript.bd',
            primaryMobile: '+8801700000002',
            address: 'Central Hospital, Dhaka',
            languagePref: 'English'
        },
        dateOfBirth: new Date('1978-06-15'),
        genderLegal: 'Female',
        practitioner: true,
        practitionerData: {
            roleType: 'Doctor',
            licenseNumber: 'DOC-2026-0001',
            specialty: ['Internal Medicine', 'Cardiology']
        }
    },
    {
        role: 'nurse',
        email: 'nurse@intelliscript.bd',
        fullName: 'Nurse Fatima',
        loginIdentity: 'nurse@intelliscript.bd',
        gridId: 'GRID-NR-0001',
        contact: {
            primaryEmail: 'nurse@intelliscript.bd',
            primaryMobile: '+8801700000006',
            address: 'Central Hospital, Dhaka',
            languagePref: 'English'
        },
        dateOfBirth: new Date('1985-02-14'),
        genderLegal: 'Female',
        practitioner: true,
        practitionerData: {
            roleType: 'Nurse',
            licenseNumber: 'NUR-2026-0001',
            specialty: ['Triage']
        }
    },
    {
        role: 'patient',
        email: 'patient@intelliscript.bd',
        fullName: 'Rafiq Hasan',
        loginIdentity: 'patient@intelliscript.bd',
        gridId: 'GRID-PT-0001',
        contact: {
            primaryEmail: 'patient@intelliscript.bd',
            primaryMobile: '+8801700000003',
            address: 'House 12, Road 8, Mirpur',
            languagePref: 'বাংলা'
        },
        dateOfBirth: new Date('1990-11-22'),
        genderLegal: 'Male',
        practitioner: false,
        patientData: {
            nationalHealthId: 'NHI-0001-2026',
            nationalId: '199011220001',
            bloodGroup: 'O+',
            emergencyContact: 'Nadia Hasan (Wife) • +8801700000010',
            guardian: 'Nadia Hasan',
            insuranceProvider: 'Holmes National Health Insurance'
        }
    },
    {
        role: 'pathologist',
        email: 'lab@intelliscript.bd',
        fullName: 'Dr. Sayeeda Khan',
        loginIdentity: 'lab@intelliscript.bd',
        gridId: 'GRID-PA-0001',
        contact: {
            primaryEmail: 'lab@intelliscript.bd',
            primaryMobile: '+8801700000005',
            address: 'Diagnostic Center, Sylhet',
            languagePref: 'English'
        },
        dateOfBirth: new Date('1982-08-09'),
        genderLegal: 'Female',
        practitioner: true,
        practitionerData: {
            roleType: 'Pathologist',
            licenseNumber: 'PATH-2026-0001',
            specialty: ['Clinical Pathology']
        }
    },
    {
        role: 'pharmacist',
        email: 'pharmacy@intelliscript.bd',
        fullName: 'Inspector Lestrade',
        loginIdentity: 'pharmacy@intelliscript.bd',
        gridId: 'GRID-PH-0001',
        contact: {
            primaryEmail: 'pharmacy@intelliscript.bd',
            primaryMobile: '+8801700000007',
            address: 'Central Pharmacy, Dhaka',
            languagePref: 'English'
        },
        dateOfBirth: new Date('1975-04-12'),
        genderLegal: 'Male',
        practitioner: true,
        practitionerData: {
            roleType: 'Pharmacist',
            licenseNumber: 'PHARM-2026-0001',
            specialty: ['Clinical Pharmacy']
        }
    }
];

const connect = async () => {
    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI is not set. Please set it in your environment or .env file.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
};

const cleanExisting = async () => {
    await PractitionerRole.deleteMany({});
    await Patient.deleteMany({});
    await User.deleteMany({});
    await Person.deleteMany({});
};

const run = async () => {
    try {
        await connect();
        console.log('🔌 Connected to MongoDB.');

        await cleanExisting();

        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

        const summary = [];

        for (const actor of actors) {
            const person = await Person.create({
                gridId: actor.gridId,
                loginIdentity: actor.loginIdentity,
                passwordHash,
                legalFullName: actor.fullName,
                contact: actor.contact,
                dateOfBirth: actor.dateOfBirth,
                genderLegal: actor.genderLegal
            });

            await User.create({
                name: actor.fullName,
                email: actor.email,
                password: passwordHash,
                role: actor.role,
                gridId: actor.gridId,
                status: 'Approved'
            });

            if (actor.role === 'patient') {
                await Patient.create({
                    personId: person._id,
                    nationalHealthId: actor.patientData.nationalHealthId,
                    nationalId: actor.patientData.nationalId,
                    bloodGroup: actor.patientData.bloodGroup,
                    emergencyContact: actor.patientData.emergencyContact,
                    guardian: actor.patientData.guardian,
                    insuranceProvider: actor.patientData.insuranceProvider
                });
            }

            if (actor.practitioner) {
                await PractitionerRole.create({
                    personId: person._id,
                    roleType: actor.practitionerData.roleType,
                    licenseNumber: actor.practitionerData.licenseNumber,
                    specialty: actor.practitionerData.specialty
                });
            }

            summary.push({ role: actor.role, email: actor.email, password: DEMO_PASSWORD });
        }

        console.log('\n✅ Seed Complete. Demo credentials:');
        summary.forEach(item => {
            console.log(` - ${item.role.toUpperCase()}: ${item.email} / ${item.password}`);
        });
        console.log('\n✨ Use these credentials to authenticate the Ministry demo accounts.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
};

run();
