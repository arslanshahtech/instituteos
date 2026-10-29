import { Types } from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
  SubjectModel,
  TeacherAssignmentModel,
  TermModel,
} from '../academics/academics.model.js';
import { AuthUserModel } from '../auth/auth.model.js';
import { StaffMemberModel, StudentModel } from '../people/people.model.js';
import { StudentSectionPlacementModel } from '../attendance/attendance.model.js';
import { CampusModel } from '../tenancy/tenancy.model.js';
import {
  ExamMarkModel,
  ExamModel,
  ExamScheduleModel,
  GradingScaleModel,
} from './examinations.model.js';
import type {
  ExamInput,
  ExamMarkInput,
  ExamMarkRecord,
  ExamRecord,
  ExamRosterStudent,
  ExamScheduleInput,
  ExamScheduleRecord,
  ExaminationsRepository,
  GradeBreakdown,
  GradingScaleInput,
  GradingScaleRecord,
} from './examinations.types.js';

const oid = (id: string) => new Types.ObjectId(id);
const iso = (value: Date) => new Date(value).toISOString();

function examRecord(record: Record<string, unknown>): ExamRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    name: String(record.name),
    type: record.type as ExamRecord['type'],
    academicYearId: String(record.academicYearId),
    termId: String(record.termId),
    campusId: String(record.campusId),
    startDate: iso(record.startDate as Date).slice(0, 10),
    endDate: iso(record.endDate as Date).slice(0, 10),
    resultsPublishedAt:
      record.resultsPublishedAt instanceof Date
        ? iso(record.resultsPublishedAt)
        : null,
    resultsPublishedBy: record.resultsPublishedBy
      ? String(record.resultsPublishedBy)
      : null,
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function scheduleRecord(record: Record<string, unknown>): ExamScheduleRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    examId: String(record.examId),
    subjectId: String(record.subjectId),
    classId: String(record.classId),
    sectionId: String(record.sectionId),
    date: iso(record.date as Date).slice(0, 10),
    startTime: String(record.startTime),
    durationMinutes: Number(record.durationMinutes),
    totalMarks: Number(record.totalMarks),
    passingMarks: Number(record.passingMarks),
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function scaleRecord(record: Record<string, unknown>): GradingScaleRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    name: String(record.name),
    gradeBreakdowns: (record.gradeBreakdowns as GradeBreakdown[]).map(
      (item) => ({ ...item }),
    ),
    isActive: Boolean(record.isActive),
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function markRecord(record: Record<string, unknown>): ExamMarkRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    examScheduleId: String(record.examScheduleId),
    studentId: String(record.studentId),
    ...(typeof record.marksObtained === 'number'
      ? { marksObtained: record.marksObtained }
      : {}),
    isAbsent: Boolean(record.isAbsent),
    ...(record.remarks ? { remarks: String(record.remarks) } : {}),
    percentage:
      typeof record.percentage === 'number' ? record.percentage : null,
    grade: typeof record.grade === 'string' ? record.grade : null,
    gpa: typeof record.gpa === 'number' ? record.gpa : null,
    createdAt: iso(record.createdAt as Date),
    updatedAt: iso(record.updatedAt as Date),
  };
}

function scopedCampus(
  campusIds?: string[],
): Record<string, unknown> | undefined {
  if (campusIds === undefined) return undefined;
  return { campusId: { $in: campusIds.map(oid) } };
}

export class MongoExaminationsRepository implements ExaminationsRepository {
  async isTeacherAssignedToSection(
    organizationId: string,
    userId: string,
    input: {
      classId: string;
      sectionId: string;
      academicYearId: string;
      subjectId: string;
    },
  ): Promise<boolean> {
    if (
      !Types.ObjectId.isValid(organizationId) ||
      !Types.ObjectId.isValid(userId)
    )
      return false;

    const user = await AuthUserModel.findById(oid(userId))
      .select({ email: 1 })
      .lean();
    const email =
      typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (!email) return false;

    const staff = await StaffMemberModel.find({
      organizationId: oid(organizationId),
      email,
      status: 'active',
    })
      .select({ _id: 1 })
      .limit(2)
      .lean();
    if (staff.length !== 1) return false;

    const assignment = await TeacherAssignmentModel.findOne({
      organizationId: oid(organizationId),
      teacherStaffId: staff[0]!._id,
      classId: oid(input.classId),
      sectionId: oid(input.sectionId),
      academicYearId: oid(input.academicYearId),
      subjectId: oid(input.subjectId),
    })
      .select({ _id: 1 })
      .lean();
    return Boolean(assignment);
  }

  async validateCampus(organizationId: string, campusId: string) {
    return Boolean(
      await CampusModel.exists({
        _id: oid(campusId),
        organizationId: oid(organizationId),
        status: 'active',
      }),
    );
  }

  async validateAcademicYear(organizationId: string, id: string) {
    return Boolean(
      await AcademicYearModel.exists({
        _id: oid(id),
        organizationId: oid(organizationId),
      }),
    );
  }

  async validateTerm(
    organizationId: string,
    academicYearId: string,
    id: string,
    startDate: string,
    endDate: string,
  ) {
    return Boolean(
      await TermModel.exists({
        _id: oid(id),
        organizationId: oid(organizationId),
        academicYearId: oid(academicYearId),
        startDate: { $lte: new Date(`${startDate}T00:00:00.000Z`) },
        endDate: { $gte: new Date(`${endDate}T00:00:00.000Z`) },
      }),
    );
  }

  async getClassCampus(organizationId: string, classId: string) {
    const record = await AcademicClassModel.findOne({
      _id: oid(classId),
      organizationId: oid(organizationId),
    })
      .select({ campusId: 1 })
      .lean();
    return record ? String(record.campusId) : null;
  }

  async validateSection(
    organizationId: string,
    classId: string,
    sectionId: string,
  ) {
    return Boolean(
      await AcademicSectionModel.exists({
        _id: oid(sectionId),
        classId: oid(classId),
        organizationId: oid(organizationId),
      }),
    );
  }

  async validateSubject(organizationId: string, subjectId: string) {
    return Boolean(
      await SubjectModel.exists({
        _id: oid(subjectId),
        organizationId: oid(organizationId),
      }),
    );
  }

  async listExams(
    organizationId: string,
    campusIds?: string[],
    campusId?: string,
    termId?: string,
  ) {
    if (campusIds?.length === 0) return [];
    const allowed = campusIds?.length
      ? campusId
        ? campusIds.includes(campusId)
          ? [campusId]
          : []
        : campusIds
      : campusId
        ? [campusId]
        : undefined;
    if (allowed?.length === 0) return [];
    const records = await ExamModel.find({
      organizationId: oid(organizationId),
      ...(allowed ? { campusId: { $in: allowed.map(oid) } } : {}),
      ...(termId ? { termId: oid(termId) } : {}),
    })
      .sort({ startDate: -1, name: 1 })
      .limit(1000)
      .lean();
    return records.map(examRecord);
  }

  async getExam(organizationId: string, id: string) {
    const record = await ExamModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    }).lean();
    return record ? examRecord(record) : null;
  }

  async createExam(
    organizationId: string,
    input: ExamInput,
  ): Promise<ExamRecord> {
    const record = await ExamModel.create({
      organizationId: oid(organizationId),
      ...input,
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      endDate: new Date(`${input.endDate}T00:00:00.000Z`),
    });
    return this.required<ExamRecord>(
      await this.getExam(organizationId, String(record._id)),
      'Exam',
    );
  }

  async updateExam(
    organizationId: string,
    id: string,
    input: Partial<ExamInput>,
  ) {
    const changes: Record<string, unknown> = { ...input };
    for (const field of ['startDate', 'endDate'] as const) {
      if (changes[field])
        changes[field] = new Date(`${changes[field]}T00:00:00.000Z`);
    }
    const record = await ExamModel.findOneAndUpdate(
      { _id: oid(id), organizationId: oid(organizationId) },
      { $set: changes },
      { new: true, runValidators: true },
    ).lean();
    return record ? examRecord(record) : null;
  }

  async deleteExam(organizationId: string, id: string) {
    const result = await ExamModel.deleteOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    });
    return result.deletedCount === 1;
  }

  async setResultsPublication(
    organizationId: string,
    examId: string,
    publishedAt: string | null,
    publishedByUserId: string | null,
  ) {
    const record = await ExamModel.findOneAndUpdate(
      { _id: oid(examId), organizationId: oid(organizationId) },
      {
        $set: {
          resultsPublishedAt: publishedAt ? new Date(publishedAt) : null,
          resultsPublishedBy: publishedByUserId ? oid(publishedByUserId) : null,
        },
      },
      { new: true, runValidators: true },
    ).lean();
    return record ? examRecord(record) : null;
  }

  async hasSchedules(organizationId: string, examId: string) {
    return Boolean(
      await ExamScheduleModel.exists({
        organizationId: oid(organizationId),
        examId: oid(examId),
      }),
    );
  }

  async listSchedules(
    organizationId: string,
    examId: string,
    campusIds?: string[],
  ) {
    if (campusIds?.length === 0) return [];
    const examFilter = {
      _id: oid(examId),
      organizationId: oid(organizationId),
      ...(scopedCampus(campusIds) ?? {}),
    };
    const exam = await ExamModel.findOne(examFilter).select({ _id: 1 }).lean();
    if (!exam) return [];
    const records = await ExamScheduleModel.find({
      organizationId: oid(organizationId),
      examId: oid(examId),
    })
      .sort({ date: 1, startTime: 1 })
      .lean();
    return records.map(scheduleRecord);
  }

  async getSchedule(organizationId: string, id: string) {
    const record = await ExamScheduleModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    }).lean();
    return record ? scheduleRecord(record) : null;
  }

  async createSchedule(
    organizationId: string,
    examId: string,
    input: ExamScheduleInput,
  ): Promise<ExamScheduleRecord> {
    const record = await ExamScheduleModel.create({
      organizationId: oid(organizationId),
      examId: oid(examId),
      ...input,
      date: new Date(`${input.date}T00:00:00.000Z`),
    });
    return this.required<ExamScheduleRecord>(
      await this.getSchedule(organizationId, String(record._id)),
      'Exam schedule',
    );
  }

  async updateSchedule(
    organizationId: string,
    id: string,
    input: Partial<ExamScheduleInput>,
  ) {
    const changes: Record<string, unknown> = { ...input };
    if (changes.date) changes.date = new Date(`${changes.date}T00:00:00.000Z`);
    const record = await ExamScheduleModel.findOneAndUpdate(
      { _id: oid(id), organizationId: oid(organizationId) },
      { $set: changes },
      { new: true, runValidators: true },
    ).lean();
    return record ? scheduleRecord(record) : null;
  }

  async deleteSchedule(organizationId: string, id: string) {
    const result = await ExamScheduleModel.deleteOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    });
    return result.deletedCount === 1;
  }

  async hasMarks(organizationId: string, scheduleId: string) {
    return Boolean(
      await ExamMarkModel.exists({
        organizationId: oid(organizationId),
        examScheduleId: oid(scheduleId),
      }),
    );
  }

  async listGradingScales(organizationId: string) {
    const records = await GradingScaleModel.find({
      organizationId: oid(organizationId),
    })
      .sort({ isActive: -1, name: 1 })
      .lean();
    return records.map(scaleRecord);
  }

  async getGradingScale(organizationId: string, id: string) {
    const record = await GradingScaleModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    }).lean();
    return record ? scaleRecord(record) : null;
  }

  async getActiveGradingScale(organizationId: string) {
    const record = await GradingScaleModel.findOne({
      organizationId: oid(organizationId),
      isActive: true,
    })
      .sort({ updatedAt: -1 })
      .lean();
    return record ? scaleRecord(record) : null;
  }

  async createGradingScale(
    organizationId: string,
    input: GradingScaleInput,
  ): Promise<GradingScaleRecord> {
    if (input.isActive)
      await GradingScaleModel.updateMany(
        { organizationId: oid(organizationId), isActive: true },
        { $set: { isActive: false } },
      );
    const record = await GradingScaleModel.create({
      organizationId: oid(organizationId),
      ...input,
    });
    return this.required<GradingScaleRecord>(
      await this.getGradingScale(organizationId, String(record._id)),
      'Grading scale',
    );
  }

  async updateGradingScale(
    organizationId: string,
    id: string,
    input: Partial<GradingScaleInput>,
  ) {
    if (input.isActive)
      await GradingScaleModel.updateMany(
        {
          organizationId: oid(organizationId),
          isActive: true,
          _id: { $ne: oid(id) },
        },
        { $set: { isActive: false } },
      );
    const record = await GradingScaleModel.findOneAndUpdate(
      { _id: oid(id), organizationId: oid(organizationId) },
      { $set: input },
      { new: true, runValidators: true },
    ).lean();
    return record ? scaleRecord(record) : null;
  }

  async deleteGradingScale(organizationId: string, id: string) {
    const result = await GradingScaleModel.deleteOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    });
    return result.deletedCount === 1;
  }

  async listRoster(
    organizationId: string,
    scheduleId: string,
    classId: string,
    sectionId: string,
    academicYearId: string,
  ): Promise<ExamRosterStudent[]> {
    const placements = await StudentSectionPlacementModel.find({
      organizationId: oid(organizationId),
      classId: oid(classId),
      sectionId: oid(sectionId),
      academicYearId: oid(academicYearId),
      status: 'active',
    })
      .select({ studentId: 1 })
      .lean();
    const studentIds = placements.map((placement) => placement.studentId);
    const students = await StudentModel.find({
      _id: { $in: studentIds },
      organizationId: oid(organizationId),
      status: 'active',
    })
      .select({ firstName: 1, lastName: 1, preferredName: 1 })
      .sort({ lastName: 1, firstName: 1 })
      .lean();
    const marks = await ExamMarkModel.find({
      organizationId: oid(organizationId),
      examScheduleId: oid(scheduleId),
      studentId: { $in: studentIds },
    }).lean();
    const marksByStudent = new Map(
      marks.map((mark) => [String(mark.studentId), markRecord(mark)]),
    );
    return students.map((student) => ({
      id: String(student._id),
      firstName: String(student.firstName),
      lastName: String(student.lastName),
      ...(student.preferredName
        ? { preferredName: String(student.preferredName) }
        : {}),
      ...(marksByStudent.has(String(student._id))
        ? { mark: marksByStudent.get(String(student._id)) }
        : {}),
    }));
  }

  async saveMarks(
    organizationId: string,
    schedule: ExamScheduleRecord,
    records: ExamMarkInput[],
    scale: GradingScaleRecord | null,
  ) {
    const gradeFor = (percentage: number) =>
      scale?.gradeBreakdowns.find(
        (item, index) =>
          percentage >= item.minPercentage &&
          (percentage < item.maxPercentage ||
            (index === scale.gradeBreakdowns.length - 1 &&
              percentage <= item.maxPercentage)),
      );
    await ExamMarkModel.bulkWrite(
      records.map((input) => {
        const percentage = input.isAbsent
          ? null
          : Math.round(
              ((input.marksObtained ?? 0) / schedule.totalMarks) * 10000,
            ) / 100;
        const grade = percentage === null ? undefined : gradeFor(percentage);
        return {
          updateOne: {
            filter: {
              organizationId: oid(organizationId),
              examScheduleId: oid(schedule.id),
              studentId: oid(input.studentId),
            },
            update: {
              $set: {
                organizationId: oid(organizationId),
                examScheduleId: oid(schedule.id),
                studentId: oid(input.studentId),
                ...(input.marksObtained === undefined
                  ? { marksObtained: null }
                  : { marksObtained: input.marksObtained }),
                isAbsent: input.isAbsent,
                remarks: input.remarks ?? '',
                percentage,
                grade: grade?.grade ?? null,
                gpa: grade?.gpa ?? null,
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: true },
    );
    const result = await ExamMarkModel.find({
      organizationId: oid(organizationId),
      examScheduleId: oid(schedule.id),
      studentId: { $in: records.map((item) => oid(item.studentId)) },
    }).lean();
    return result.map(markRecord);
  }

  async getStudentReport(
    organizationId: string,
    examId: string,
    studentId: string,
  ) {
    const exam = await this.getExam(organizationId, examId);
    if (!exam) return null;
    const studentExists = await StudentModel.exists({
      _id: oid(studentId),
      organizationId: oid(organizationId),
    });
    if (!studentExists) return null;
    const schedules = await ExamScheduleModel.find({
      organizationId: oid(organizationId),
      examId: oid(examId),
    })
      .sort({ date: 1, startTime: 1 })
      .lean();
    const placement = await StudentSectionPlacementModel.findOne({
      organizationId: oid(organizationId),
      studentId: oid(studentId),
      academicYearId: oid(exam.academicYearId),
      status: 'active',
    }).lean();
    if (!placement) return null;
    const studentSchedules = schedules.filter(
      (schedule) =>
        String(schedule.classId) === String(placement.classId) &&
        String(schedule.sectionId) === String(placement.sectionId),
    );
    const results = await Promise.all(
      studentSchedules.map(async (schedule) => {
        const [subject, mark] = await Promise.all([
          SubjectModel.findOne({
            _id: schedule.subjectId,
            organizationId: oid(organizationId),
          })
            .select({ name: 1 })
            .lean(),
          ExamMarkModel.findOne({
            organizationId: oid(organizationId),
            examScheduleId: schedule._id,
            studentId: oid(studentId),
          }).lean(),
        ]);
        return {
          schedule: scheduleRecord(schedule),
          subjectName: subject ? String(subject.name) : 'Subject',
          mark: mark ? markRecord(mark) : null,
        };
      }),
    );
    return { exam, results };
  }

  private required<T>(record: T | null, label: string): T {
    if (!record)
      throw new AppError(
        500,
        'PERSISTENCE_ERROR',
        `${label} could not be saved.`,
      );
    return record;
  }
}
