import mongoose, { Schema } from 'mongoose';
import type {
  StaffAttendanceStatus,
  StudentAttendanceStatus,
} from './attendance.types.js';

const studentAttendanceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicClass',
      required: true,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicSection',
      required: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', required: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'leave'] satisfies StudentAttendanceStatus[],
      required: true,
    },
    remarks: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, versionKey: false },
);
studentAttendanceSchema.index(
  { organizationId: 1, studentId: 1, date: 1, academicYearId: 1 },
  { unique: true, name: 'uniq_student_daily_attendance' },
);
studentAttendanceSchema.index({
  organizationId: 1,
  campusId: 1,
  date: 1,
  sectionId: 1,
});

const staffAttendanceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'StaffMember',
      required: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus' },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: [
        'present',
        'absent',
        'half-day',
        'on-leave',
      ] satisfies StaffAttendanceStatus[],
      required: true,
    },
    remarks: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, versionKey: false },
);
staffAttendanceSchema.index(
  { organizationId: 1, staffId: 1, date: 1 },
  { unique: true, name: 'uniq_staff_daily_attendance' },
);
staffAttendanceSchema.index({ organizationId: 1, campusId: 1, date: 1 });

const studentSectionPlacementSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicClass',
      required: true,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicSection',
      required: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', required: true },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      required: true,
      default: 'active',
    },
  },
  { timestamps: true, versionKey: false },
);
studentSectionPlacementSchema.index(
  { organizationId: 1, studentId: 1, academicYearId: 1 },
  { unique: true, name: 'uniq_student_placement_per_year' },
);
studentSectionPlacementSchema.index({
  organizationId: 1,
  sectionId: 1,
  academicYearId: 1,
  status: 1,
});

export const StudentAttendanceModel =
  mongoose.models.StudentAttendance ??
  mongoose.model('StudentAttendance', studentAttendanceSchema);
export const StaffAttendanceModel =
  mongoose.models.StaffAttendance ??
  mongoose.model('StaffAttendance', staffAttendanceSchema);
export const StudentSectionPlacementModel =
  mongoose.models.StudentSectionPlacement ??
  mongoose.model('StudentSectionPlacement', studentSectionPlacementSchema);
