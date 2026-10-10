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
    sourceApplicationId: {
      type: Schema.Types.ObjectId,
      ref: 'AdmissionApplication',
      default: null,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
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
  },
  { timestamps: true, versionKey: false },
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
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    employeeCode: { type: String, trim: true, maxlength: 40 },
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
  { unique: true, sparse: true, name: 'uniq_enrollment_application_record' },
);

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
