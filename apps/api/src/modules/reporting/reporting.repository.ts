import { Types } from 'mongoose';
import { AuditLogModel } from '../audit/audit.model.js';
import {
  StaffAttendanceModel,
  StudentAttendanceModel,
} from '../attendance/attendance.model.js';
import {
  PaymentReceiptModel,
  StudentInvoiceModel,
} from '../finance/finance.model.js';
import { FinanceExpenseModel } from '../finance/finance-operations.model.js';
import {
  PayrollAdvanceModel,
  PayrollMonthModel,
} from '../finance/payroll.model.js';
import {
  ExamMarkModel,
  ExamModel,
  ExamScheduleModel,
} from '../examinations/examinations.model.js';
import {
  AdmissionApplicationModel,
  AdmissionInquiryModel,
  StaffMemberModel,
  StudentModel,
} from '../people/people.model.js';
import { CampusModel } from '../tenancy/tenancy.model.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  SubjectModel,
} from '../academics/academics.model.js';
import type {
  AuditLogPage,
  AuditLogQuery,
  AttendanceStats,
  OrganizationSummary,
  ReportDataRow,
  ReportFilters,
  ReportingRepository,
  ReportType,
} from './reporting.types.js';

const oid = (id: string) => new Types.ObjectId(id);
const iso = (value: Date | string) => new Date(value).toISOString();
const campusFilter = (campusIds?: string[]) =>
  campusIds ? { campusId: { $in: campusIds.map(oid) } } : {};

function decimalAmount(value: unknown): string {
  const amount = String(value ?? '0');
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match)
    throw new Error('A finance aggregate returned an invalid amount.');
  const fraction = match[3] ?? '';
  if (fraction.length > 2 && /[1-9]/.test(fraction.slice(2))) {
    throw new Error(
      'A finance aggregate returned more than two decimal places.',
    );
  }
  return `${match[1]}${match[2]}.${fraction.slice(0, 2).padEnd(2, '0')}`;
}

function amountCents(value: unknown): number {
  const amount = String(value ?? '0');
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) throw new Error('A finance record returned an invalid amount.');
  const fraction = (match[3] ?? '').padEnd(2, '0');
  if (fraction.length > 2 && /[1-9]/.test(fraction.slice(2))) {
    throw new Error('A finance record returned more than two decimal places.');
  }
  const cents = Number(match[2]) * 100 + Number(fraction.slice(0, 2));
  return match[1] === '-' ? -cents : cents;
}

function nonNegativeDifference(first: unknown, ...subtract: unknown[]): string {
  const cents = Math.max(
    0,
    amountCents(first) -
      subtract.reduce<number>((total, value) => total + amountCents(value), 0),
  );
  return (
    Math.floor(cents / 100).toString() +
    '.' +
    String(cents % 100).padStart(2, '0')
  );
}

function auditLogRecord(
  record: Record<string, unknown>,
): AuditLogPage['items'][number] {
  const metadata = record.metadata;
  const normalizedMetadata =
    metadata instanceof Map
      ? Object.fromEntries(metadata)
      : typeof metadata === 'object' &&
          metadata !== null &&
          !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : undefined;
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    ...(record.campusId ? { campusId: String(record.campusId) } : {}),
    actorId: String(record.actorId),
    action: String(record.action),
    entityType: String(record.entityType),
    ...(record.entityId ? { entityId: String(record.entityId) } : {}),
    ...(normalizedMetadata ? { metadata: normalizedMetadata } : {}),
    ...(record.ipAddress ? { ipAddress: String(record.ipAddress) } : {}),
    createdAt: iso(record.createdAt as Date),
  };
}

function dateFilter(query: AuditLogQuery): Record<string, Date> | undefined {
  if (!query.dateFrom && !query.dateTo) return undefined;
  return {
    ...(query.dateFrom
      ? { $gte: new Date(`${query.dateFrom}T00:00:00.000Z`) }
      : {}),
    ...(query.dateTo
      ? {
          $lt: new Date(
            new Date(`${query.dateTo}T00:00:00.000Z`).getTime() + 86_400_000,
          ),
        }
      : {}),
  };
}

function rowDate(value: unknown): string {
  return iso(value as Date);
}

export class MongoReportingRepository implements ReportingRepository {
  async countActiveStudents(
    organizationId: string,
    campusIds?: string[],
  ): Promise<number> {
    if (campusIds?.length === 0) return 0;
    return StudentModel.countDocuments({
      organizationId: oid(organizationId),
      status: 'active',
      ...campusFilter(campusIds),
    });
  }

  async countActiveStaff(
    organizationId: string,
    campusIds?: string[],
  ): Promise<number> {
    if (campusIds?.length === 0) return 0;
    return StaffMemberModel.countDocuments({
      organizationId: oid(organizationId),
      status: 'active',
      ...campusFilter(campusIds),
    });
  }

  async countActiveClasses(
    organizationId: string,
    campusIds?: string[],
  ): Promise<number> {
    if (campusIds?.length === 0) return 0;
    // Academic classes have no lifecycle status field; all existing classes are active.
    return AcademicClassModel.countDocuments({
      organizationId: oid(organizationId),
      ...campusFilter(campusIds),
    });
  }

  async getFinanceOverview(
    organizationId: string,
    campusIds?: string[],
  ): Promise<OrganizationSummary['finance']> {
    if (campusIds?.length === 0) {
      return {
        totalInvoiced: '0.00',
        totalCollected: '0.00',
        totalPending: '0.00',
        totalOverdue: '0.00',
      };
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [totals] = await StudentInvoiceModel.aggregate<{
      totalInvoiced: unknown;
      totalCollected: unknown;
      totalPending: unknown;
      totalOverdue: unknown;
    }>([
      {
        $match: {
          organizationId: oid(organizationId),
          ...campusFilter(campusIds),
        },
      },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$totalAmount' },
          totalCollected: { $sum: '$paidAmount' },
          totalPending: {
            $sum: {
              $cond: [
                { $gt: ['$totalAmount', '$paidAmount'] },
                { $subtract: ['$totalAmount', '$paidAmount'] },
                0,
              ],
            },
          },
          totalOverdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ['$dueDate', today] },
                    { $gt: ['$totalAmount', '$paidAmount'] },
                  ],
                },
                { $subtract: ['$totalAmount', '$paidAmount'] },
                0,
              ],
            },
          },
        },
      },
    ]);
    return {
      totalInvoiced: decimalAmount(totals?.totalInvoiced),
      totalCollected: decimalAmount(totals?.totalCollected),
      totalPending: decimalAmount(totals?.totalPending),
      totalOverdue: decimalAmount(totals?.totalOverdue),
    };
  }

  async getTodayAttendanceStats(
    organizationId: string,
    campusIds?: string[],
  ): Promise<AttendanceStats> {
    if (campusIds?.length === 0) return { total: 0, attended: 0 };
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const baseFilter = {
      organizationId: oid(organizationId),
      date: { $gte: today, $lt: tomorrow },
      ...campusFilter(campusIds),
    };
    const [studentTotal, studentAttended, staffTotal, staffAttended] =
      await Promise.all([
        StudentAttendanceModel.countDocuments(baseFilter),
        StudentAttendanceModel.countDocuments({
          ...baseFilter,
          status: 'present',
        }),
        StaffAttendanceModel.countDocuments(baseFilter),
        StaffAttendanceModel.countDocuments({
          ...baseFilter,
          status: { $in: ['present', 'half-day'] },
        }),
      ]);
    return {
      total: studentTotal + staffTotal,
      attended: studentAttended + staffAttended,
    };
  }

  async listAuditLogs(
    organizationId: string,
    query: AuditLogQuery,
    campusIds?: string[],
  ): Promise<AuditLogPage> {
    if (campusIds?.length === 0) return { items: [], total: 0 };
    const filter: Record<string, unknown> = {
      organizationId: oid(organizationId),
      ...campusFilter(campusIds),
    };
    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    const dates = dateFilter(query);
    if (dates) filter.createdAt = dates;
    const [records, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(((query.page ?? 1) - 1) * (query.pageSize ?? 20))
        .limit(query.pageSize ?? 20)
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);
    return {
      items: records.map((record) =>
        auditLogRecord(record as unknown as Record<string, unknown>),
      ),
      total,
    };
  }

  async exportReportData(
    organizationId: string,
    reportType: ReportType,
    campusIds?: string[],
    filters: ReportFilters = {},
  ): Promise<ReportDataRow[]> {
    if (campusIds?.length === 0) return [];
    const scopedCampuses = filters.campusId ? [filters.campusId] : campusIds;
    if (scopedCampuses?.length === 0) return [];
    const filter = {
      organizationId: oid(organizationId),
      ...campusFilter(scopedCampuses),
    };
    const dateRange =
      filters.dateFrom || filters.dateTo
        ? {
            ...(filters.dateFrom
              ? { $gte: new Date(filters.dateFrom + 'T00:00:00.000Z') }
              : {}),
            ...(filters.dateTo
              ? {
                  $lt: new Date(
                    new Date(filters.dateTo + 'T00:00:00.000Z').getTime() +
                      86_400_000,
                  ),
                }
              : {}),
          }
        : undefined;
    const applyDates = (field: string) =>
      dateRange ? { [field]: dateRange } : {};

    if (reportType === 'finance') {
      const records = await StudentInvoiceModel.find({
        ...filter,
        ...applyDates('issueDate'),
      })
        .select({
          invoiceNumber: 1,
          studentId: 1,
          campusId: 1,
          totalAmount: 1,
          paidAmount: 1,
          status: 1,
          dueDate: 1,
          issueDate: 1,
        })
        .sort({ issueDate: -1, _id: -1 })
        .lean();
      return records.map((record) => ({
        invoiceNumber: String(record.invoiceNumber),
        studentId: String(record.studentId),
        campusId: String(record.campusId),
        totalAmount: decimalAmount(record.totalAmount),
        paidAmount: decimalAmount(record.paidAmount),
        balance: nonNegativeDifference(record.totalAmount, record.paidAmount),
        status: String(record.status),
        dueDate: rowDate(record.dueDate),
        issueDate: rowDate(record.issueDate),
      }));
    }
    if (reportType === 'payments') {
      const invoices = await StudentInvoiceModel.find(filter)
        .select({ _id: 1 })
        .lean();
      if (!invoices.length) return [];
      const records = await PaymentReceiptModel.find({
        organizationId: oid(organizationId),
        invoiceId: { $in: invoices.map((item) => item._id) },
        ...applyDates('paymentDate'),
      })
        .sort({ paymentDate: -1, _id: -1 })
        .lean();
      return records.map((record) => ({
        receiptNumber: String(record.receiptNumber),
        invoiceId: String(record.invoiceId),
        studentId: String(record.studentId),
        amountPaid: decimalAmount(record.amountPaid),
        paymentMethod: String(record.paymentMethod),
        transactionReference: record.transactionReference ?? '',
        paymentDate: rowDate(record.paymentDate),
      }));
    }
    if (reportType === 'expenses') {
      const records = await FinanceExpenseModel.find({
        ...filter,
        ...applyDates('expenseDate'),
      })
        .sort({ expenseDate: -1, _id: -1 })
        .lean();
      return records.map((record) => ({
        description: String(record.description),
        category: String(record.category),
        amount: decimalAmount(record.amount),
        paymentMethod: String(record.paymentMethod ?? ''),
        reference: String(record.reference ?? ''),
        expenseDate: rowDate(record.expenseDate),
        campusId: record.campusId ? String(record.campusId) : '',
      }));
    }
    if (reportType === 'payroll') {
      const records = await PayrollMonthModel.find({
        ...filter,
        ...applyDates('createdAt'),
      })
        .sort({ month: -1, staffName: 1 })
        .lean();
      return records.map((record) => ({
        month: String(record.month),
        staffName: String(record.staffName),
        employeeCode: String(record.employeeCode ?? ''),
        grossSalary: decimalAmount(record.grossSalary),
        advanceAdjusted: decimalAmount(record.advanceAdjusted),
        paidAmount: decimalAmount(record.paidAmount),
        payableBalance: nonNegativeDifference(
          record.grossSalary,
          record.advanceAdjusted,
          record.paidAmount,
        ),
        status: String(record.status),
        campusId: record.campusId ? String(record.campusId) : '',
      }));
    }
    if (reportType === 'advances') {
      const records = await PayrollAdvanceModel.find({
        ...filter,
        ...applyDates('advanceDate'),
      })
        .sort({ advanceDate: -1, _id: -1 })
        .lean();
      return records.map((record) => ({
        staffName: String(record.staffName),
        amount: decimalAmount(record.amount),
        adjustedAmount: decimalAmount(record.adjustedAmount),
        remainingAmount: nonNegativeDifference(
          record.amount,
          record.adjustedAmount,
        ),
        paymentMethod: String(record.paymentMethod),
        reference: String(record.reference ?? ''),
        advanceDate: rowDate(record.advanceDate),
      }));
    }
    if (reportType === 'admissions') {
      const records = await AdmissionApplicationModel.find({
        ...filter,
        ...applyDates('createdAt'),
      })
        .sort({ createdAt: -1, _id: -1 })
        .lean();
      const converted = records.length
        ? await StudentModel.find({
            organizationId: oid(organizationId),
            sourceApplicationId: { $in: records.map((record) => record._id) },
          })
            .select({ _id: 1, sourceApplicationId: 1 })
            .lean()
        : [];
      const convertedByApplication = new Map(
        converted.map((student) => [
          String(student.sourceApplicationId),
          String(student._id),
        ]),
      );
      return records.map((record) => ({
        applicationId: String(record._id),
        applicantName: String(record.firstName) + ' ' + String(record.lastName),
        email: String(record.email ?? ''),
        phone: String(record.phone ?? ''),
        program: String(record.program ?? ''),
        source: String(record.source ?? ''),
        guardianName: String(record.guardianName ?? ''),
        guardianPhone: String(record.guardianPhone ?? ''),
        feePlan: String(record.feePlan ?? ''),
        status: String(record.status),
        campusId: record.campusId ? String(record.campusId) : '',
        convertedStudentId:
          convertedByApplication.get(String(record._id)) ?? '',
        createdAt: rowDate(record.createdAt),
      }));
    }
    if (reportType === 'admission-inquiries') {
      const records = await AdmissionInquiryModel.find({
        ...filter,
        ...applyDates('createdAt'),
      })
        .sort({ createdAt: -1, _id: -1 })
        .lean();
      return records.map((record) => ({
        inquiryId: String(record._id),
        applicantName: String(record.firstName) + ' ' + String(record.lastName),
        email: String(record.email ?? ''),
        phone: String(record.phone ?? ''),
        source: String(record.source ?? ''),
        gradeLevelInterest: String(record.gradeLevelInterest ?? ''),
        status: String(record.status),
        campusId: record.campusId ? String(record.campusId) : '',
        createdAt: rowDate(record.createdAt),
      }));
    }
    if (reportType === 'organization') {
      const campuses = await CampusModel.find(filter)
        .select({ name: 1, status: 1, phone: 1, email: 1, address: 1 })
        .sort({ name: 1, _id: 1 })
        .lean();
      if (!campuses.length) return [];
      const campusIds = campuses.map((campus) => campus._id);
      const [students, staff, classes] = await Promise.all([
        StudentModel.aggregate([
          { $match: { ...filter, campusId: { $in: campusIds } } },
          { $group: { _id: '$campusId', total: { $sum: 1 } } },
        ]),
        StaffMemberModel.aggregate([
          { $match: { ...filter, campusId: { $in: campusIds } } },
          { $group: { _id: '$campusId', total: { $sum: 1 } } },
        ]),
        AcademicClassModel.aggregate([
          { $match: { ...filter, campusId: { $in: campusIds } } },
          { $group: { _id: '$campusId', total: { $sum: 1 } } },
        ]),
      ]);
      const counts = (rows: Array<{ _id: Types.ObjectId; total: number }>) =>
        new Map(rows.map((row) => [String(row._id), row.total]));
      const studentCounts = counts(students);
      const staffCounts = counts(staff);
      const classCounts = counts(classes);
      return campuses.map((campus) => ({
        campusName: String(campus.name),
        status: String(campus.status),
        city: String(campus.address?.city ?? ''),
        phone: String(campus.phone ?? ''),
        email: String(campus.email ?? ''),
        studentCount: studentCounts.get(String(campus._id)) ?? 0,
        staffCount: staffCounts.get(String(campus._id)) ?? 0,
        classCount: classCounts.get(String(campus._id)) ?? 0,
      }));
    }
    if (reportType === 'staff') {
      const records = await StaffMemberModel.find({
        ...filter,
        ...applyDates('createdAt'),
      })
        .select({
          firstName: 1,
          lastName: 1,
          employeeCode: 1,
          staffType: 1,
          department: 1,
          designation: 1,
          qualification: 1,
          status: 1,
          email: 1,
          phone: 1,
          campusId: 1,
          createdAt: 1,
        })
        .sort({ lastName: 1, firstName: 1 })
        .lean();
      return records.map((record) => ({
        staffId: String(record._id),
        firstName: String(record.firstName),
        lastName: String(record.lastName),
        employeeCode: String(record.employeeCode ?? ''),
        staffType: String(record.staffType),
        department: String(record.department ?? ''),
        designation: String(record.designation ?? ''),
        qualification: String(record.qualification ?? ''),
        status: String(record.status),
        email: String(record.email ?? ''),
        phone: String(record.phone ?? ''),
        campusId: record.campusId ? String(record.campusId) : '',
        createdAt: rowDate(record.createdAt),
      }));
    }
    if (reportType === 'attendance') {
      const [students, staff] = await Promise.all([
        StudentAttendanceModel.find({ ...filter, ...applyDates('date') })
          .select({
            studentId: 1,
            classId: 1,
            sectionId: 1,
            campusId: 1,
            date: 1,
            status: 1,
          })
          .sort({ date: -1, _id: -1 })
          .lean(),
        StaffAttendanceModel.find({ ...filter, ...applyDates('date') })
          .select({ staffId: 1, campusId: 1, date: 1, status: 1 })
          .sort({ date: -1, _id: -1 })
          .lean(),
      ]);
      const [studentProfiles, staffProfiles, classes, sections] =
        await Promise.all([
          StudentModel.find({
            organizationId: oid(organizationId),
            _id: { $in: students.map((record) => record.studentId) },
          })
            .select({ firstName: 1, lastName: 1, registrationNumber: 1 })
            .lean(),
          StaffMemberModel.find({
            organizationId: oid(organizationId),
            _id: { $in: staff.map((record) => record.staffId) },
          })
            .select({ firstName: 1, lastName: 1, employeeCode: 1 })
            .lean(),
          AcademicClassModel.find({
            organizationId: oid(organizationId),
            _id: { $in: students.map((record) => record.classId) },
          })
            .select({ name: 1 })
            .lean(),
          AcademicSectionModel.find({
            organizationId: oid(organizationId),
            _id: { $in: students.map((record) => record.sectionId) },
          })
            .select({ name: 1 })
            .lean(),
        ]);
      const studentById = new Map(
        studentProfiles.map((profile) => [String(profile._id), profile]),
      );
      const staffById = new Map(
        staffProfiles.map((profile) => [String(profile._id), profile]),
      );
      const classById = new Map(
        classes.map((record) => [String(record._id), String(record.name)]),
      );
      const sectionById = new Map(
        sections.map((record) => [String(record._id), String(record.name)]),
      );
      return [
        ...students.map((record) => {
          const profile = studentById.get(String(record.studentId));
          return {
            personType: 'student',
            personName: profile
              ? `${String(profile.firstName)} ${String(profile.lastName)}`.trim()
              : 'Student profile unavailable',
            personIdentifier: String(profile?.registrationNumber ?? ''),
            personId: String(record.studentId),
            campusId: String(record.campusId),
            className: classById.get(String(record.classId)) ?? '',
            sectionName: sectionById.get(String(record.sectionId)) ?? '',
            date: rowDate(record.date),
            status: String(record.status),
          };
        }),
        ...staff.map((record) => {
          const profile = staffById.get(String(record.staffId));
          return {
            personType: 'staff',
            personName: profile
              ? `${String(profile.firstName)} ${String(profile.lastName)}`.trim()
              : 'Staff profile unavailable',
            personIdentifier: String(profile?.employeeCode ?? ''),
            personId: String(record.staffId),
            campusId: record.campusId ? String(record.campusId) : '',
            className: '',
            sectionName: '',
            date: rowDate(record.date),
            status: String(record.status),
          };
        }),
      ];
    }
    if (reportType === 'classes') {
      const records = await AcademicClassModel.find(filter)
        .sort({ sortOrder: 1, name: 1 })
        .lean();
      const sections = await AcademicSectionModel.find({
        organizationId: oid(organizationId),
        classId: { $in: records.map((record) => record._id) },
      }).lean();
      return records.map((record) => ({
        className: String(record.name),
        classCode: String(record.code),
        campusId: String(record.campusId),
        sections: sections
          .filter((section) => String(section.classId) === String(record._id))
          .map((section) => String(section.name))
          .join(', '),
      }));
    }
    if (reportType === 'sections') {
      const classes = await AcademicClassModel.find(filter)
        .select({ _id: 1, name: 1, code: 1, campusId: 1 })
        .lean();
      if (!classes.length) return [];
      const classMap = new Map(classes.map((item) => [String(item._id), item]));
      const records = await AcademicSectionModel.find({
        organizationId: oid(organizationId),
        classId: { $in: classes.map((item) => item._id) },
      })
        .sort({ name: 1 })
        .lean();
      return records.map((record) => {
        const parent = classMap.get(String(record.classId));
        return {
          sectionName: String(record.name),
          className: String(parent?.name ?? ''),
          classCode: String(parent?.code ?? ''),
          capacity: record.capacity ?? '',
          campusId: String(parent?.campusId ?? ''),
        };
      });
    }
    if (reportType === 'subjects') {
      const classIds = scopedCampuses
        ? (
            await AcademicClassModel.find({ ...filter })
              .select({ _id: 1 })
              .lean()
          ).map((record) => record._id)
        : undefined;
      const subjectFilter = {
        organizationId: oid(organizationId),
        ...(classIds ? { classIds: { $in: classIds } } : {}),
      };
      const records = await SubjectModel.find(subjectFilter)
        .sort({ name: 1 })
        .lean();
      return records.map((record) => ({
        subjectName: String(record.name),
        subjectCode: String(record.code),
        totalMarks: record.totalMarks,
        passingPercentage: record.passingPercentage,
        description: String(record.description ?? ''),
        classIds: (record.classIds ?? []).map(String).join(', '),
      }));
    }
    if (reportType === 'exams' || reportType === 'results') {
      const exams = await ExamModel.find({
        ...filter,
        ...applyDates('startDate'),
      })
        .sort({ startDate: -1 })
        .lean();
      if (reportType === 'exams')
        return exams.map((record) => ({
          examName: String(record.name),
          type: String(record.type),
          academicYearId: String(record.academicYearId),
          startDate: rowDate(record.startDate),
          endDate: rowDate(record.endDate),
          resultsPublished: Boolean(record.resultsPublishedAt),
          campusId: String(record.campusId),
        }));
      const schedules = await ExamScheduleModel.find({
        organizationId: oid(organizationId),
        examId: { $in: exams.map((exam) => exam._id) },
      }).lean();
      const marks = await ExamMarkModel.find({
        organizationId: oid(organizationId),
        examScheduleId: { $in: schedules.map((schedule) => schedule._id) },
      })
        .populate('studentId', 'firstName lastName')
        .lean();
      const scheduleMap = new Map(
        schedules.map((schedule) => [String(schedule._id), schedule]),
      );
      return marks.map((mark) => {
        const schedule = scheduleMap.get(String(mark.examScheduleId));
        const student = mark.studentId as unknown as {
          firstName?: string;
          lastName?: string;
        } | null;
        return {
          examId: String(schedule?.examId ?? ''),
          studentName: student
            ? String(student.firstName ?? '') +
              ' ' +
              String(student.lastName ?? '')
            : '',
          marksObtained: mark.marksObtained ?? '',
          totalMarks: schedule?.totalMarks ?? '',
          percentage: mark.percentage ?? '',
          grade: String(mark.grade ?? ''),
          absent: Boolean(mark.isAbsent),
          remarks: String(mark.remarks ?? ''),
        };
      });
    }
    if (reportType === 'audit') {
      const records = await AuditLogModel.find({
        ...filter,
        ...applyDates('createdAt'),
      })
        .sort({ createdAt: -1, _id: -1 })
        .limit(10000)
        .lean();
      return records.map((record) => ({
        actorId: String(record.actorId),
        action: String(record.action),
        entityType: String(record.entityType),
        entityId: record.entityId ? String(record.entityId) : '',
        ipAddress: String(record.ipAddress ?? ''),
        createdAt: rowDate(record.createdAt),
      }));
    }
    const records = await StudentModel.find({
      ...filter,
      ...applyDates('createdAt'),
    })
      .select({
        campusId: 1,
        firstName: 1,
        lastName: 1,
        status: 1,
        createdAt: 1,
        registrationNumber: 1,
        email: 1,
        phone: 1,
        gender: 1,
        dateOfBirth: 1,
      })
      .sort({ lastName: 1, firstName: 1, _id: 1 })
      .lean();
    return records.map((record) => ({
      studentId: String(record._id),
      registrationNumber: String(record.registrationNumber ?? ''),
      campusId: record.campusId ? String(record.campusId) : null,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      status: String(record.status),
      gender: String(record.gender ?? ''),
      email: String(record.email ?? ''),
      phone: String(record.phone ?? ''),
      dateOfBirth: record.dateOfBirth ? rowDate(record.dateOfBirth) : '',
      createdAt: rowDate(record.createdAt),
    }));
  }
}
