import { Types } from 'mongoose';
import { AuditLogModel } from '../audit/audit.model.js';
import {
  StaffAttendanceModel,
  StudentAttendanceModel,
} from '../attendance/attendance.model.js';
import { AcademicClassModel } from '../academics/academics.model.js';
import { StudentInvoiceModel } from '../finance/finance.model.js';
import {
  StaffMemberModel,
  StudentModel,
} from '../people/people.model.js';
import type {
  AuditLogPage,
  AuditLogQuery,
  AttendanceStats,
  OrganizationSummary,
  ReportDataRow,
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
  if (!match) throw new Error('A finance aggregate returned an invalid amount.');
  const fraction = match[3] ?? '';
  if (fraction.length > 2 && /[1-9]/.test(fraction.slice(2))) {
    throw new Error('A finance aggregate returned more than two decimal places.');
  }
  return `${match[1]}${match[2]}.${fraction.slice(0, 2).padEnd(2, '0')}`;
}

function auditLogRecord(
  record: Record<string, unknown>,
): AuditLogPage['items'][number] {
  const metadata = record.metadata;
  const normalizedMetadata =
    metadata instanceof Map
      ? Object.fromEntries(metadata)
      : typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)
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
            new Date(`${query.dateTo}T00:00:00.000Z`).getTime() +
              86_400_000,
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
    const [
      studentTotal,
      studentAttended,
      staffTotal,
      staffAttended,
    ] = await Promise.all([
      StudentAttendanceModel.countDocuments(baseFilter),
      StudentAttendanceModel.countDocuments({
        ...baseFilter,
        status: { $in: ['present', 'late'] },
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
  ): Promise<ReportDataRow[]> {
    if (campusIds?.length === 0) return [];
    const filter = {
      organizationId: oid(organizationId),
      ...campusFilter(campusIds),
    };
    if (reportType === 'finance') {
      const records = await StudentInvoiceModel.find(filter)
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
        status: String(record.status),
        dueDate: rowDate(record.dueDate),
        issueDate: rowDate(record.issueDate),
      }));
    }
    if (reportType === 'attendance') {
      const [students, staff] = await Promise.all([
        StudentAttendanceModel.find(filter)
          .select({ studentId: 1, campusId: 1, date: 1, status: 1 })
          .sort({ date: -1, _id: -1 })
          .lean(),
        StaffAttendanceModel.find(filter)
          .select({ staffId: 1, campusId: 1, date: 1, status: 1 })
          .sort({ date: -1, _id: -1 })
          .lean(),
      ]);
      return [
        ...students.map((record) => ({
          personType: 'student',
          personId: String(record.studentId),
          campusId: String(record.campusId),
          date: rowDate(record.date),
          status: String(record.status),
        })),
        ...staff.map((record) => ({
          personType: 'staff',
          personId: String(record.staffId),
          campusId: record.campusId ? String(record.campusId) : null,
          date: rowDate(record.date),
          status: String(record.status),
        })),
      ];
    }
    const records = await StudentModel.find(filter)
      .select({
        campusId: 1,
        firstName: 1,
        lastName: 1,
        status: 1,
        createdAt: 1,
      })
      .sort({ lastName: 1, firstName: 1, _id: 1 })
      .lean();
    return records.map((record) => ({
      studentId: String(record._id),
      campusId: record.campusId ? String(record.campusId) : null,
      firstName: String(record.firstName),
      lastName: String(record.lastName),
      status: String(record.status),
      createdAt: rowDate(record.createdAt),
    }));
  }
}
