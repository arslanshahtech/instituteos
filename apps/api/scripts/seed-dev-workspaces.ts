import mongoose from 'mongoose';
import { hashPassword } from '../src/modules/auth/password.js';
import { AuthUserModel } from '../src/modules/auth/auth.model.js';
import {
  OrganizationModel,
  CampusModel,
  MembershipModel,
} from '../src/modules/tenancy/tenancy.model.js';
import {
  StaffMemberModel,
  StudentModel,
  GuardianModel,
  StudentGuardianLinkModel,
} from '../src/modules/people/people.model.js';
import {
  AcademicYearModel,
  AcademicClassModel,
  AcademicSectionModel,
  SubjectModel,
  TeacherAssignmentModel,
} from '../src/modules/academics/academics.model.js';
import { StudentSectionPlacementModel } from '../src/modules/attendance/attendance.model.js';

const databaseUri = process.env.DEV_SEED_MONGODB_URI;
const password = process.env.DEV_TEST_PASSWORD;
const emails = {
  admin: 'admin@instituteos.test',
  teacher: 'teacher@instituteos.test',
  parent: 'parent@instituteos.test',
};

async function main() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Refusing to seed: NODE_ENV must be development.');
  }
  if (!databaseUri) {
    throw new Error(
      'Set DEV_SEED_MONGODB_URI to a dedicated development database URI.',
    );
  }
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error(
      'Set DEV_TEST_PASSWORD to a 12–128 character local-only password.',
    );
  }

  await mongoose.connect(databaseUri);
  const databaseName = mongoose.connection.name;
  if (databaseName !== 'instituteos_dev') {
    await mongoose.disconnect();
    throw new Error(
      'Refusing to write: the database name must be exactly instituteos_dev.',
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const now = new Date();
    const ensureUser = async (email: string, displayName: string) =>
      AuthUserModel.findOneAndUpdate(
        { email },
        {
          $set: {
            displayName,
            passwordHash,
            status: 'active',
            emailVerifiedAt: now,
            verificationTokenHash: null,
            verificationExpiresAt: null,
          },
        },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      );

    const [admin, teacher, parent] = await Promise.all([
      ensureUser(emails.admin, 'Local QA Admin'),
      ensureUser(emails.teacher, 'Local QA Teacher'),
      ensureUser(emails.parent, 'Local QA Parent'),
    ]);

    const organization = await OrganizationModel.findOneAndUpdate(
      { name: 'InstituteOS Local QA' },
      {
        $set: { status: 'active', institutionType: 'college' },
        $setOnInsert: {
          name: 'InstituteOS Local QA',
          createdByUserId: admin._id,
          contactEmail: emails.admin,
          timezone: 'Asia/Karachi',
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
    const organizationId = organization._id;

    const campus = await CampusModel.findOneAndUpdate(
      { organizationId, name: 'Main Campus' },
      {
        $setOnInsert: { organizationId, name: 'Main Campus', status: 'active' },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    for (const [user, role] of [
      [admin, 'organization_owner'],
      [teacher, 'teacher'],
      [parent, 'parent_guardian'],
    ] as const) {
      await MembershipModel.findOneAndUpdate(
        { organizationId, userId: user._id },
        {
          $set: { role, status: 'active', campusIds: [campus._id] },
          $setOnInsert: { organizationId, userId: user._id },
        },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      );
    }

    const teacherProfile = await StaffMemberModel.findOneAndUpdate(
      { organizationId, email: emails.teacher },
      {
        $set: {
          userId: teacher._id,
          firstName: 'Local QA',
          lastName: 'Teacher',
          designation: 'Teacher',
          department: 'Mathematics',
          subjects: ['Mathematics'],
          status: 'active',
          campusId: campus._id,
        },
        $setOnInsert: { organizationId, email: emails.teacher },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    const guardian = await GuardianModel.findOneAndUpdate(
      { organizationId, email: emails.parent },
      {
        $set: {
          firstName: 'Local QA',
          lastName: 'Parent',
          relationship: 'guardian',
        },
        $setOnInsert: { organizationId, email: emails.parent },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    const student = await StudentModel.findOneAndUpdate(
      { organizationId, firstName: 'Local QA', lastName: 'Student' },
      {
        $set: {
          campusId: campus._id,
          status: 'active',
          guardianIds: [guardian._id],
        },
        $setOnInsert: {
          organizationId,
          firstName: 'Local QA',
          lastName: 'Student',
          contactEmail: 'student@instituteos.test',
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    await StudentGuardianLinkModel.findOneAndUpdate(
      { organizationId, studentId: student._id, guardianId: guardian._id },
      {
        $set: { relationship: 'guardian', isPrimary: true },
        $setOnInsert: {
          organizationId,
          studentId: student._id,
          guardianId: guardian._id,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    const academicYear = await AcademicYearModel.findOneAndUpdate(
      { organizationId, name: '2026-27 Local QA' },
      {
        $set: {
          status: 'active',
          startDate: new Date('2026-08-01'),
          endDate: new Date('2027-07-31'),
        },
        $setOnInsert: { organizationId, name: '2026-27 Local QA' },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
    const academicClass = await AcademicClassModel.findOneAndUpdate(
      { organizationId, campusId: campus._id, code: 'QA8' },
      {
        $set: { name: 'Grade 8', sortOrder: 8 },
        $setOnInsert: { organizationId, campusId: campus._id, code: 'QA8' },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
    const section = await AcademicSectionModel.findOneAndUpdate(
      { organizationId, classId: academicClass._id, name: 'A' },
      {
        $setOnInsert: { organizationId, classId: academicClass._id, name: 'A' },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
    const subject = await SubjectModel.findOneAndUpdate(
      { organizationId, code: 'QAMATH' },
      {
        $set: { name: 'Mathematics', classIds: [academicClass._id] },
        $setOnInsert: { organizationId, code: 'QAMATH' },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    await TeacherAssignmentModel.findOneAndUpdate(
      {
        organizationId,
        teacherStaffId: teacherProfile._id,
        subjectId: subject._id,
        classId: academicClass._id,
        sectionId: section._id,
        academicYearId: academicYear._id,
      },
      {
        $setOnInsert: {
          organizationId,
          teacherStaffId: teacherProfile._id,
          subjectId: subject._id,
          classId: academicClass._id,
          sectionId: section._id,
          academicYearId: academicYear._id,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    await StudentSectionPlacementModel.findOneAndUpdate(
      {
        organizationId,
        studentId: student._id,
        academicYearId: academicYear._id,
      },
      {
        $set: {
          classId: academicClass._id,
          sectionId: section._id,
          campusId: campus._id,
          status: 'active',
        },
        $setOnInsert: {
          organizationId,
          studentId: student._id,
          academicYearId: academicYear._id,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    console.log('Development workspace seed completed.');
    console.log(`Database: ${databaseName}`);
    console.log(`Admin:   ${emails.admin}`);
    console.log(`Teacher: ${emails.teacher}`);
    console.log(`Parent:  ${emails.parent}`);
    console.log(
      'Password: the value supplied in DEV_TEST_PASSWORD (not written to files).',
    );
    console.log('Seed data is isolated to the *_dev database.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Development seed failed.',
  );
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
