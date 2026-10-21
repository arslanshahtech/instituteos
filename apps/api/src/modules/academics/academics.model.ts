import mongoose, { Schema } from 'mongoose';
import type { AcademicYearStatus } from './academics.types.js';

const academicYearSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'archived'] satisfies AcademicYearStatus[],
      default: 'active',
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);
academicYearSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, name: 'uniq_academic_year_name' },
);

const termSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);
termSchema.index(
  { organizationId: 1, academicYearId: 1, name: 1 },
  { unique: true, name: 'uniq_term_per_academic_year' },
);

const classSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    campusId: { type: Schema.Types.ObjectId, ref: 'Campus', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
  },
  { timestamps: true, versionKey: false },
);
classSchema.index(
  { organizationId: 1, campusId: 1, code: 1 },
  { unique: true, name: 'uniq_class_code_per_campus' },
);

const sectionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicClass',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    capacity: { type: Number, min: 1, max: 10000 },
  },
  { timestamps: true, versionKey: false },
);
sectionSchema.index(
  { organizationId: 1, classId: 1, name: 1 },
  { unique: true, name: 'uniq_section_name_per_class' },
);

const subjectSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    department: { type: String, trim: true, maxlength: 100 },
  },
  { timestamps: true, versionKey: false },
);
subjectSchema.index(
  { organizationId: 1, code: 1 },
  { unique: true, name: 'uniq_subject_code_per_organization' },
);

const teacherAssignmentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    teacherStaffId: {
      type: Schema.Types.ObjectId,
      ref: 'StaffMember',
      required: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
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
  },
  { timestamps: true, versionKey: false },
);
teacherAssignmentSchema.index(
  {
    organizationId: 1,
    teacherStaffId: 1,
    subjectId: 1,
    classId: 1,
    sectionId: 1,
    academicYearId: 1,
  },
  { unique: true, name: 'uniq_teacher_section_per_year' },
);

const teacherTimetableSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    teacherStaffId: {
      type: Schema.Types.ObjectId,
      ref: 'StaffMember',
      required: true,
    },
    teacherAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'TeacherAssignment',
      required: true,
    },
    dayOfWeek: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    room: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true, versionKey: false },
);
teacherTimetableSchema.index(
  { organizationId: 1, teacherStaffId: 1, dayOfWeek: 1, startTime: 1 },
  { name: 'teacher_timetable_by_day' },
);

export const TeacherTimetableModel =
  mongoose.models.TeacherTimetable ??
  mongoose.model('TeacherTimetable', teacherTimetableSchema);

export const AcademicYearModel =
  mongoose.models.AcademicYear ??
  mongoose.model('AcademicYear', academicYearSchema);
export const TermModel =
  mongoose.models.AcademicTerm ?? mongoose.model('AcademicTerm', termSchema);
export const AcademicClassModel =
  mongoose.models.AcademicClass ?? mongoose.model('AcademicClass', classSchema);
export const AcademicSectionModel =
  mongoose.models.AcademicSection ??
  mongoose.model('AcademicSection', sectionSchema);
export const SubjectModel =
  mongoose.models.Subject ?? mongoose.model('Subject', subjectSchema);
export const TeacherAssignmentModel =
  mongoose.models.TeacherAssignment ??
  mongoose.model('TeacherAssignment', teacherAssignmentSchema);
