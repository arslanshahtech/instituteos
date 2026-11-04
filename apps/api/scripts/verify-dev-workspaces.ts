import mongoose from 'mongoose';
import { AuthUserModel } from '../src/modules/auth/auth.model.js';
import { verifyPassword } from '../src/modules/auth/password.js';
import {
  OrganizationModel,
  MembershipModel,
} from '../src/modules/tenancy/tenancy.model.js';
import {
  StaffMemberModel,
  GuardianModel,
  StudentModel,
  StudentGuardianLinkModel,
} from '../src/modules/people/people.model.js';
import { TeacherAssignmentModel } from '../src/modules/academics/academics.model.js';
import { StudentSectionPlacementModel } from '../src/modules/attendance/attendance.model.js';

const uri = process.env.DEV_SEED_MONGODB_URI;
const password = process.env.DEV_TEST_PASSWORD;
const expected = [
  { email: 'admin@instituteos.test', role: 'organization_owner' },
  { email: 'teacher@instituteos.test', role: 'teacher' },
  { email: 'parent@instituteos.test', role: 'parent_guardian' },
] as const;

async function main() {
  if (!uri) throw new Error('DEV_SEED_MONGODB_URI is required.');
  if (!password)
    throw new Error(
      'DEV_TEST_PASSWORD is required for credential verification.',
    );
  await mongoose.connect(uri, { readPreference: 'secondaryPreferred' });
  if (mongoose.connection.name !== 'instituteos_dev') {
    throw new Error('Refusing verification: database is not instituteos_dev.');
  }

  try {
    // The owner may rename the organization in normal product use. Resolve
    // the workspace through the seeded Admin account instead of a hardcoded
    // organization display name, so verification never requires resetting it.
    const admin = await AuthUserModel.findOne({
      email: 'admin@instituteos.test',
    }).lean();
    const adminMembership = admin
      ? await MembershipModel.findOne({
          userId: admin._id,
          role: 'organization_owner',
          status: 'active',
        }).lean()
      : null;
    const organization = adminMembership
      ? await OrganizationModel.findOne({
          _id: adminMembership.organizationId,
          status: 'active',
        }).lean()
      : null;
    if (!organization)
      throw new Error('Admin workspace membership or organization is missing/inactive.');

    let failures = 0;
    for (const account of expected) {
      const user = await AuthUserModel.findOne({ email: account.email })
        .select('+passwordHash')
        .lean();
      const membership = user
        ? await MembershipModel.findOne({
            organizationId: organization._id,
            userId: user._id,
            role: account.role,
            status: 'active',
          }).lean()
        : null;
      const passwordMatches = Boolean(
        user?.passwordHash &&
        (await verifyPassword(password, user.passwordHash)),
      );
      const ok = Boolean(
        user &&
        user.passwordHash &&
        user.status === 'active' &&
        user.emailVerifiedAt &&
        membership &&
        passwordMatches,
      );
      if (!ok) failures += 1;
      console.log(
        `${ok ? 'PASS' : 'FAIL'} ${account.email} | role=${account.role} | active, verified, membership and passwordMatches=${passwordMatches}`,
      );
    }

    const teacher = await AuthUserModel.findOne({
      email: 'teacher@instituteos.test',
    }).lean();
    const teacherProfile = teacher
      ? await StaffMemberModel.findOne({
          organizationId: organization._id,
          userId: teacher._id,
          email: teacher.email,
          status: 'active',
        }).lean()
      : null;
    const assignments = teacherProfile
      ? await TeacherAssignmentModel.countDocuments({
          organizationId: organization._id,
          teacherStaffId: teacherProfile._id,
        })
      : 0;
    const teacherOk = Boolean(teacherProfile && assignments > 0);
    if (!teacherOk) failures += 1;
    console.log(
      `${teacherOk ? 'PASS' : 'FAIL'} Teacher profile and subject/class assignment | assignments=${assignments}`,
    );

    const guardian = await GuardianModel.findOne({
      organizationId: organization._id,
      email: 'parent@instituteos.test',
    }).lean();
    const [guardianLinks, legacyStudents] = guardian
      ? await Promise.all([
          StudentGuardianLinkModel.find({
            organizationId: organization._id,
            guardianId: guardian._id,
          })
            .select({ studentId: 1 })
            .lean(),
          StudentModel.find({
            organizationId: organization._id,
            status: 'active',
            guardianIds: guardian._id,
          })
            .select({ _id: 1 })
            .lean(),
        ])
      : [[], []];
    const linkedStudentIds = [
      ...new Set([
        ...guardianLinks.map((link) => String(link.studentId)),
        ...legacyStudents.map((student) => String(student._id)),
      ]),
    ];
    const linkedStudents = linkedStudentIds.length
      ? await StudentModel.find({
          organizationId: organization._id,
          status: 'active',
          _id: { $in: linkedStudentIds },
        })
          .select({ _id: 1, firstName: 1, lastName: 1 })
          .lean()
      : [];
    const placements = linkedStudents.length
      ? await StudentSectionPlacementModel.countDocuments({
          organizationId: organization._id,
          studentId: { $in: linkedStudents.map((student) => student._id) },
          status: 'active',
        })
      : 0;
    const parentOk = Boolean(
      guardian && linkedStudents.length > 0 && placements > 0,
    );
    if (!parentOk) failures += 1;
    console.log(
      `${parentOk ? 'PASS' : 'FAIL'} Parent/Guardian linked children | linkedChildren=${linkedStudents.length} | explicitLinks=${guardianLinks.length} | legacyLinks=${legacyStudents.length} | activePlacements=${placements}`,
    );

    console.log(`Database verified: ${mongoose.connection.name}`);
    console.log(`Organization: ${organization.name}`);
    console.log(`Verification failures: ${failures}`);
    if (failures) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Development verification failed.',
  );
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
