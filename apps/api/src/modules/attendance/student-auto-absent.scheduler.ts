import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import {
  AcademicYearModel,
  SectionTimetableModel,
} from '../academics/academics.model.js';
import { AuditLogModel } from '../audit/audit.model.js';
import { EventHolidayModel } from '../events-holidays/events-holidays.model.js';
import { StudentModel } from '../people/people.model.js';
import { OrganizationModel } from '../tenancy/tenancy.model.js';
import {
  AttendanceSettingsModel,
  AttendanceJobLockModel,
} from './attendance-settings.model.js';
import {
  StudentAttendanceModel,
  StudentSectionPlacementModel,
} from './attendance.model.js';

const SYSTEM_ACTOR_ID = new Types.ObjectId('000000000000000000000000');
const JOB_ID = 'student-auto-absent';

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    day: new Date(
      `${values.year}-${values.month}-${values.day}T00:00:00.000Z`,
    ).getUTCDay(),
  };
}

const dayNames = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

async function processOrganization(organizationId: Types.ObjectId, now: Date) {
  const [settings, organization] = await Promise.all([
    AttendanceSettingsModel.findOne({ organizationId }).lean(),
    OrganizationModel.findById(organizationId)
      .select({ timezone: 1, createdByUserId: 1 })
      .lean(),
  ]);
  if (!settings?.autoMarkUnmarkedAbsent || !organization) return 0;

  const timezone = settings.timezone || organization.timezone || 'Asia/Karachi';
  let local: ReturnType<typeof localParts>;
  try {
    local = localParts(now, timezone);
  } catch {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'attendance.auto_absent.invalid_timezone',
        organizationId: String(organizationId),
        timezone,
      }),
    );
    return 0;
  }
  if (local.time < settings.markingCutoffTime) return 0;
  if (!(settings.workingDays ?? []).includes(dayNames[local.day]!)) return 0;

  const dayStart = new Date(`${local.date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);
  const [holiday, academicYear] = await Promise.all([
    EventHolidayModel.exists({
      organizationId,
      type: 'holiday',
      noClasses: true,
      startDate: { $lte: dayEnd },
      endDate: { $gte: dayStart },
    }),
    AcademicYearModel.findOne({
      organizationId,
      status: 'active',
      startDate: { $lte: dayEnd },
      endDate: { $gte: dayStart },
    })
      .select({ _id: 1 })
      .lean(),
  ]);
  if (holiday || !academicYear) return 0;

  const placements = await StudentSectionPlacementModel.find({
    organizationId,
    academicYearId: academicYear._id,
    status: 'active',
  })
    .select({ studentId: 1, classId: 1, sectionId: 1, campusId: 1 })
    .lean();
  if (!placements.length) return 0;

  const timetableRows = await SectionTimetableModel.find({
    organizationId,
    academicYearId: academicYear._id,
  })
    .select({ sectionId: 1, workingDays: 1 })
    .lean();
  const timetableDays = new Map(
    timetableRows.map((row) => [String(row.sectionId), row.workingDays]),
  );
  const eligiblePlacements = placements.filter((placement) => {
    const workingDays =
      timetableDays.get(String(placement.sectionId)) ??
      settings.workingDays ??
      [];
    return workingDays.includes(dayNames[local.day]!);
  });
  const activeStudents = await StudentModel.find({
    organizationId,
    status: 'active',
    _id: { $in: eligiblePlacements.map((placement) => placement.studentId) },
  })
    .select({ _id: 1 })
    .lean();
  const activeStudentIds = new Set(
    activeStudents.map((student) => String(student._id)),
  );
  const operations = eligiblePlacements
    .filter((placement) => activeStudentIds.has(String(placement.studentId)))
    .map((placement) => ({
      updateOne: {
        filter: {
          organizationId,
          studentId: placement.studentId,
          date: dayStart,
          academicYearId: academicYear._id,
        },
        update: {
          $setOnInsert: {
            organizationId,
            studentId: placement.studentId,
            classId: placement.classId,
            sectionId: placement.sectionId,
            academicYearId: academicYear._id,
            campusId: placement.campusId,
            date: dayStart,
            status: 'absent',
            remarks: 'Automatically marked absent after the attendance cutoff.',
          },
        },
        upsert: true,
      },
    }));

  if (!operations.length) return 0;
  const result = await StudentAttendanceModel.bulkWrite(operations, {
    ordered: false,
  });
  const createdCount = result.upsertedCount ?? 0;

  if (createdCount > 0) {
    await AuditLogModel.create({
      organizationId,
      actorId: SYSTEM_ACTOR_ID,
      action: 'STUDENT_ATTENDANCE_AUTO_ABSENT',
      entityType: 'StudentAttendance',
      entityId: String(academicYear._id),
      metadata: { date: local.date, createdCount, source: 'system_scheduler' },
    });
  }
  return createdCount;
}

export async function runStudentAutoAbsentJob(now = new Date()) {
  const ownerId = randomUUID();
  const leaseNow = new Date();
  try {
    await AttendanceJobLockModel.findOneAndUpdate(
      { _id: JOB_ID, $or: [{ leaseUntil: { $lte: leaseNow } }, { ownerId }] },
      {
        $set: {
          ownerId,
          leaseUntil: new Date(leaseNow.getTime() + 4 * 60_000),
        },
      },
      { upsert: true, new: true },
    );
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    )
      return;
    throw error;
  }

  try {
    const organizations = await AttendanceSettingsModel.find({
      autoMarkUnmarkedAbsent: true,
    })
      .select({ organizationId: 1 })
      .lean();
    for (const settings of organizations) {
      try {
        const createdCount = await processOrganization(
          settings.organizationId,
          now,
        );
        if (createdCount > 0) {
          console.info(
            JSON.stringify({
              level: 'info',
              event: 'attendance.auto_absent.completed',
              organizationId: String(settings.organizationId),
              createdCount,
            }),
          );
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'attendance.auto_absent.organization_failed',
            organizationId: String(settings.organizationId),
            errorName: error instanceof Error ? error.name : 'UnknownError',
          }),
        );
      }
    }
  } finally {
    await AttendanceJobLockModel.deleteOne({ _id: JOB_ID, ownerId });
  }
}

export function startStudentAutoAbsentScheduler() {
  const timer = setInterval(() => {
    void runStudentAutoAbsentJob().catch((error: unknown) => {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'attendance.auto_absent.job_failed',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
    });
  }, 60_000);
  timer.unref();
  void runStudentAutoAbsentJob().catch((error: unknown) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'attendance.auto_absent.startup_failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
  });
  return () => clearInterval(timer);
}
