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
    description: { type: String, trim: true, maxlength: 500, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'archived'] satisfies AcademicYearStatus[],
      default: 'archived',
      required: true,
    },
  },
  { timestamps: true, versionKey: false },
);
academicYearSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, name: 'uniq_academic_year_name' },
);
// Supports organization-scoped session lists ordered newest first.
academicYearSchema.index(
  { organizationId: 1, startDate: -1 },
  { name: 'academic_years_by_organization_start_date' },
);
// Database-enforced invariant: no two active years for the same organization.
academicYearSchema.index(
  { organizationId: 1 },
  {
    unique: true,
    name: 'uniq_one_active_academic_year_per_organization',
    partialFilterExpression: { status: 'active' },
  },
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
    sortOrder: { type: Number, min: 0, max: 100000, default: 0 },
    studyLevel: { type: String, enum: ['first_year', 'second_year', 'other'] },
    programName: { type: String, trim: true, maxlength: 120 },
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
    // Transactional write lock shared by placement and capacity changes.
    placementRevision: { type: Number, default: 0, select: false },
  },
  { timestamps: true, versionKey: false },
);
sectionSchema.index(
  { organizationId: 1, classId: 1, name: 1 },
  { unique: true, name: 'uniq_section_name_per_class' },
);

const subjectMarkComponentSchema = new Schema(
  {
    key: { type: String, enum: ['theory', 'practical', 'viva'], required: true },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    totalMarks: { type: Number, required: true, min: 0, max: 100000 },
    passingMarks: { type: Number, required: true, min: 0, max: 100000 },
    enabled: { type: Boolean, required: true, default: true },
  },
  { _id: false },
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
    totalMarks: {
      type: Number,
      required: true,
      min: 1,
      max: 100000,
      default: 100,
    },
    passingPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 40,
    },
    // Optional for legacy subjects; new subject setup stores component defaults.
    markComponents: { type: [subjectMarkComponentSchema], default: undefined },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    // Empty/missing classIds keeps legacy organization-wide subject behavior.
    classIds: [
      { type: Schema.Types.ObjectId, ref: 'AcademicClass', default: [] },
    ],
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
  // Versioned name avoids colliding with the legacy Atlas index, whose key
  // omitted subjectId. The legacy index is left untouched for data safety.
  { unique: true, name: 'uniq_teacher_subject_section_per_year_v2' },
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
      enum: [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ],
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

export type SectionTimetableEntryRecord = {
  _id?: mongoose.Types.ObjectId;
  type: 'class' | 'break' | 'activity';
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subjectId?: mongoose.Types.ObjectId | { name?: string };
  teacherStaffId?: mongoose.Types.ObjectId;
  additionalTeacherStaffId?: mongoose.Types.ObjectId;
  room?: string;
  name?: string;
  description?: string;
};

export type SectionTimetableRecord = {
  _id?: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  academicYearId: mongoose.Types.ObjectId | { name?: string };
  sectionId:
    | mongoose.Types.ObjectId
    | { name?: string; classId?: mongoose.Types.ObjectId };
  workingDays: string[];
  entries: SectionTimetableEntryRecord[];
  createdAt: Date;
  updatedAt: Date;
};
const sectionTimetableEntrySchema = new Schema(
  {
    type: {
      type: String,
      enum: ['class', 'break', 'activity'],
      required: true,
    },
    dayOfWeek: {
      type: String,
      enum: [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ],
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
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },
    teacherStaffId: { type: Schema.Types.ObjectId, ref: 'StaffMember' },
    additionalTeacherStaffId: {
      type: Schema.Types.ObjectId,
      ref: 'StaffMember',
    },
    room: { type: String, trim: true, maxlength: 80 },
    name: { type: String, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
  },
  { _id: true },
);

const sectionTimetableSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicSection',
      required: true,
    },
    workingDays: {
      type: [String],
      enum: [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ],
      default: [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ],
      required: true,
    },
    entries: { type: [sectionTimetableEntrySchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);
sectionTimetableSchema.index(
  { organizationId: 1, academicYearId: 1, sectionId: 1 },
  { unique: true, name: 'uniq_section_timetable_per_year' },
);
sectionTimetableSchema.index(
  { organizationId: 1, 'entries.teacherStaffId': 1, 'entries.dayOfWeek': 1 },
  { name: 'section_timetable_main_teacher_lookup' },
);
sectionTimetableSchema.index(
  {
    organizationId: 1,
    'entries.additionalTeacherStaffId': 1,
    'entries.dayOfWeek': 1,
  },
  { name: 'section_timetable_additional_teacher_lookup' },
);

export const SectionTimetableModel =
  mongoose.models.SectionTimetable ??
  mongoose.model('SectionTimetable', sectionTimetableSchema);

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
