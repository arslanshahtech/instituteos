import mongoose from 'mongoose';
import { AuthUserModel } from '../src/modules/auth/auth.model.js';
import {
  MembershipModel,
  OrganizationInvitationModel,
  OrganizationModel,
} from '../src/modules/tenancy/tenancy.model.js';
import { StaffMemberModel } from '../src/modules/people/people.model.js';
import { TeacherAssignmentModel } from '../src/modules/academics/academics.model.js';

const uri = process.env.DEV_SEED_MONGODB_URI;
const email = 'teacher.onboarding@instituteos.test';

async function main() {
  if (!uri) throw new Error('DEV_SEED_MONGODB_URI is required.');
  await mongoose.connect(uri, { readPreference: 'secondaryPreferred' });
  if (mongoose.connection.name !== 'instituteos_dev') {
    throw new Error('Refusing verification outside instituteos_dev.');
  }

  try {
    const organization = await OrganizationModel.findOne({
      name: 'InstituteOS Local QA',
      status: 'active',
    }).lean();
    if (!organization) throw new Error('Local QA organization missing.');

    const user = await AuthUserModel.findOne({ email }).lean();
    const invitation = await OrganizationInvitationModel.findOne({
      organizationId: organization._id,
      email,
      role: 'teacher',
    })
      .sort({ createdAt: -1 })
      .lean();
    const membership = user
      ? await MembershipModel.findOne({
          organizationId: organization._id,
          userId: user._id,
          role: 'teacher',
          status: 'active',
        }).lean()
      : null;
    const staff = user
      ? await StaffMemberModel.findOne({
          organizationId: organization._id,
          email,
          userId: user._id,
          status: 'active',
        }).lean()
      : null;
    const assignments = staff
      ? await TeacherAssignmentModel.countDocuments({
          organizationId: organization._id,
          teacherStaffId: staff._id,
        })
      : 0;

    const checks = {
      accountExists: Boolean(user),
      accountActiveAndVerified: Boolean(
        user?.status === 'active' && user.emailVerifiedAt,
      ),
      invitationAccepted: Boolean(
        invitation?.status === 'accepted' && invitation.acceptedAt,
      ),
      activeTeacherMembership: Boolean(membership),
      staffProfileLinkedToUser: Boolean(staff),
      teacherAssignmentsPresent: assignments > 0,
    };

    for (const [name, passed] of Object.entries(checks)) {
      console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
    }
    console.log(`Teacher assignments: ${assignments}`);
    console.log(`Database: ${mongoose.connection.name}`);
    if (Object.values(checks).some((passed) => !passed)) {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Invitation verification failed.');
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
