import mongoose, { Schema } from 'mongoose';
import type {
  ApplicationStatus,
  EnrollmentStatus,
  GuardianRelationshipType,
  InquiryStatus,
  StaffStatus,
  StudentStatus,
} from './people.types.js';

const studentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      default: null,
    },
    familyId: { type: Schema.Types.ObjectId, ref: 'StudentFamily', default: null, index: true },
    sourceApplicationId: {
      type: Schema.Types.ObjectId,
      ref: 'AdmissionApplication',
      default: null,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    registrationNumber: { type: String, trim: true, uppercase: true, maxlength: 40 },
    photoUrl: { type: String, trim: true, maxlength: 500 },
    fatherName: { type: String, trim: true, maxlength: 160 },
    motherName: { type: String, trim: true, maxlength: 160 },
    parentMobile: { type: String, trim: true, maxlength: 40 },
    secondaryNumber: { type: String, trim: true, maxlength: 40 },
    nationality: { type: String, trim: true, maxlength: 80 },
    religion: { type: String, trim: true, maxlength: 80 },
    birthPlace: { type: String, trim: true, maxlength: 120 },
    nationalId: { type: String, trim: true, maxlength: 40 },
    specialNeeds: { type: String, trim: true, maxlength: 500 },
    preferredName: { type: String, trim: true, maxlength: 80 },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, trim: true, maxlength: 40 },
    status: {
      type: String,
      enum: ['active', 'inactive', 'withdrawn'] satisfies StudentStatus[],
      default: 'active',
      required: true,
    },
    contactEmail: { type: String, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: {
      line1: { type: String, trim: true, maxlength: 160 },
      line2: { type: String, trim: true, maxlength: 160 },
      city: { type: String, trim: true, maxlength: 100 },
      region: { type: String, trim: true, maxlength: 100 },
      postalCode: { type: String, trim: true, maxlength: 30 },
      country: { type: String, trim: true, maxlength: 100 },
    },
    emergencyContact: {
      name: { type: String, trim: true, maxlength: 120 },
      relationship: { type: String, trim: true, maxlength: 80 },
      phone: { type: String, trim: true, maxlength: 40 },
    },
    academicHistory: [
      {
        schoolName: { type: String, trim: true, maxlength: 160 },
        qualification: { type: String, trim: true, maxlength: 160 },
        year: { type: String, trim: true, maxlength: 30 },
        notes: { type: String, trim: true, maxlength: 250 },
      },
    ],
    guardianIds: [
      { type: Schema.Types.ObjectId, ref: 'Guardian', default: [] },
    ],
    previousDues: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);
studentSchema.index(
  { organizationId: 1, registrationNumber: 1 },
  {
    unique: true,
    name: 'uniq_student_registration_number',
    partialFilterExpression: { registrationNumber: { $type: 'string' } },
  },
);
studentSchema.index({
  organizationId: 1,
  status: 1,
  lastName: 1,
  firstName: 1,
});
studentSchema.index(
  { organizationId: 1, sourceApplicationId: 1 },
  {
    unique: true,
    name: 'uniq_student_applicant_record',
    partialFilterExpression: {
      sourceApplicationId: { $type: 'objectId' },
    },
  },
);

const guardianSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    relationship: {
      type: String,
      enum: [
        'father',
        'mother',
        'guardian',
        'other',
      ] satisfies GuardianRelationshipType[],
      default: 'guardian',
    },
    phone: { type: String, trim: true, maxlength: 40 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    cnic: { type: String, trim: true, maxlength: 40 },
    occupation: { type: String, trim: true, maxlength: 120 },
    monthlyIncome: { type: Schema.Types.Decimal128, min: 0 },
    communicationPreference: {
      type: String,
      enum: ['sms', 'email', 'both'],
      default: 'email',
    },
    address: {
      line1: { type: String, trim: true, maxlength: 160 },
      line2: { type: String, trim: true, maxlength: 160 },
      city: { type: String, trim: true, maxlength: 100 },
      region: { type: String, trim: true, maxlength: 100 },
      postalCode: { type: String, trim: true, maxlength: 30 },
      country: { type: String, trim: true, maxlength: 100 },
    },
  },
  { timestamps: true, versionKey: false },
);
guardianSchema.index({ organizationId: 1, lastName: 1, firstName: 1 });

const guardianLinkSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    guardianId: {
      type: Schema.Types.ObjectId,
      ref: 'Guardian',
      required: true,
      index: true,
    },
    relationship: {
      type: String,
      enum: [
        'father',
        'mother',
        'guardian',
        'other',
      ] satisfies GuardianRelationshipType[],
      required: true,
    },
    isPrimary: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);
guardianLinkSchema.index(
  { studentId: 1, guardianId: 1 },
  { unique: true, name: 'uniq_student_guardian_link' },
);

const staffMemberSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'AuthUser',
      default: null,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    employeeCode: { type: String, trim: true, maxlength: 40 },
    staffType: { type: String, enum: ['teacher', 'other_staff'], default: 'other_staff', required: true },
    department: { type: String, trim: true, maxlength: 100 },
    designation: { type: String, trim: true, maxlength: 100 },
    qualification: { type: String, trim: true, maxlength: 240 },
    qualifications: [{ type: String, trim: true, maxlength: 160 }],
    subjects: [{ type: String, trim: true, maxlength: 100 }],
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, trim: true, maxlength: 40 },
    status: {
      type: String,
      enum: [
        'active',
        'on_leave',
        'terminated',
        'inactive',
      ] satisfies StaffStatus[],
      default: 'active',
      required: true,
    },
    role: { type: String, trim: true, maxlength: 80 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
  },
  { timestamps: true, versionKey: false },
);
staffMemberSchema.index({ organizationId: 1, status: 1, department: 1 });
staffMemberSchema.index(
  { organizationId: 1, userId: 1 },
  {
    unique: true,
    name: 'uniq_staff_account_per_organization',
    partialFilterExpression: { userId: { $type: 'objectId' } },
  },
);

const inquirySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      default: null,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    source: { type: String, trim: true, maxlength: 80 },
    status: {
      type: String,
      enum: [
        'new',
        'contacted',
        'qualified',
        'converted',
        'closed',
      ] satisfies InquiryStatus[],
      default: 'new',
      required: true,
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    gradeLevelInterest: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true, versionKey: false },
);
inquirySchema.index({ organizationId: 1, status: 1, createdAt: -1 });

const applicationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      default: null,
    },
    inquiryId: {
      type: Schema.Types.ObjectId,
      ref: 'AdmissionInquiry',
      default: null,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    source: { type: String, trim: true, maxlength: 80 },
    program: { type: String, trim: true, maxlength: 120 },
    dateOfBirth: { type: String, trim: true, maxlength: 10 },
    guardianName: { type: String, trim: true, maxlength: 160 },
    guardianPhone: { type: String, trim: true, maxlength: 40 },
    feePlan: {
      type: String,
      enum: ['Standard', 'Scholarship', 'Sibling plan'],
    },
    status: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'in_review',
        'approved',
        'rejected',
        'admitted',
      ] satisfies ApplicationStatus[],
      default: 'draft',
      required: true,
    },
    notes: { type: String, trim: true, maxlength: 1200 },
    decisionReason: { type: String, trim: true, maxlength: 400 },
  },
  { timestamps: true, versionKey: false },
);
applicationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

const enrollmentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      default: null,
    },
    sourceApplicationId: {
      type: Schema.Types.ObjectId,
      ref: 'AdmissionApplication',
      default: null,
    },
    gradeLevel: { type: String, trim: true, maxlength: 80 },
    academicYearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', default: null },
    registrationNumber: { type: String, trim: true, uppercase: true, maxlength: 40 },
    admissionFee: { type: Schema.Types.Decimal128, min: 0, default: '0.00' },
    registrationFee: { type: Schema.Types.Decimal128, min: 0, default: '0.00' },
    securityDeposit: { type: Schema.Types.Decimal128, min: 0, default: '0.00' },
    monthlyFee: { type: Schema.Types.Decimal128, min: 0, default: '0.00' },
    admissionType: { type: String, enum: ['single', 'family'], default: 'single' },
    discountCategory: { type: String, enum: ['none', 'sibling', 'staff', 'merit', 'other'], default: 'none' },
    discountType: { type: String, enum: ['fixed', 'percentage'] },
    discountValue: { type: Schema.Types.Decimal128, min: 0, default: '0.00' },
    previousSchool: { type: String, trim: true, maxlength: 160 },
    leavingReason: { type: String, trim: true, maxlength: 500 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['active', 'completed', 'withdrawn'] satisfies EnrollmentStatus[],
      default: 'active',
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);
enrollmentSchema.index({ organizationId: 1, status: 1, studentId: 1 });
enrollmentSchema.index(
  { organizationId: 1, sourceApplicationId: 1 },
  { unique: true, name: 'uniq_enrollment_application_record', partialFilterExpression: { sourceApplicationId: { $type: 'objectId' } } },
);


const studentFamilySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    familyNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 24 },
    name: { type: String, trim: true, maxlength: 120 },
    primaryContactMobile: { type: String, trim: true, maxlength: 40 },
    guardianIds: [{ type: Schema.Types.ObjectId, ref: 'Guardian' }],
    studentIds: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  },
  { timestamps: true, versionKey: false },
);
studentFamilySchema.index({ organizationId: 1, familyNumber: 1 }, { unique: true, name: 'uniq_family_number_per_organization' });

const peopleSequenceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, versionKey: false },
);
peopleSequenceSchema.index({ organizationId: 1, name: 1 }, { unique: true, name: 'uniq_people_sequence_per_organization' });

export const StudentFamilyModel = mongoose.models.StudentFamily ?? mongoose.model('StudentFamily', studentFamilySchema);
export const PeopleSequenceModel = mongoose.models.PeopleSequence ?? mongoose.model('PeopleSequence', peopleSequenceSchema);

export const StudentModel =
  mongoose.models.Student ?? mongoose.model('Student', studentSchema);
export const GuardianModel =
  mongoose.models.Guardian ?? mongoose.model('Guardian', guardianSchema);
export const StudentGuardianLinkModel =
  mongoose.models.StudentGuardianLink ??
  mongoose.model('StudentGuardianLink', guardianLinkSchema);
export const StaffMemberModel =
  mongoose.models.StaffMember ??
  mongoose.model('StaffMember', staffMemberSchema);
export const AdmissionInquiryModel =
  mongoose.models.AdmissionInquiry ??
  mongoose.model('AdmissionInquiry', inquirySchema);
export const AdmissionApplicationModel =
  mongoose.models.AdmissionApplication ??
  mongoose.model('AdmissionApplication', applicationSchema);
export const EnrollmentModel =
  mongoose.models.Enrollment ?? mongoose.model('Enrollment', enrollmentSchema);
