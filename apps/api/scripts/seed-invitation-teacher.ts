import mongoose from 'mongoose';
import { AuthUserModel } from '../src/modules/auth/auth.model.js';
import {
  OrganizationModel,
  CampusModel,
} from '../src/modules/tenancy/tenancy.model.js';
import { StaffMemberModel } from '../src/modules/people/people.model.js';
import {
  AcademicYearModel,
  AcademicClassModel,
  AcademicSectionModel,
  SubjectModel,
  TeacherAssignmentModel,
} from '../src/modules/academics/academics.model.js';

const uri = process.env.DEV_SEED_MONGODB_URI;
const email = 'teacher.onboarding@instituteos.test';

async function main() {
  if (!uri) throw new Error('DEV_SEED_MONGODB_URI is required.');
  await mongoose.connect(uri);
  if (mongoose.connection.name !== 'instituteos_dev') {
    throw new Error('Refusing to write outside instituteos_dev.');
  }

  try {
    if (await AuthUserModel.exists({ email })) {
      throw new Error('The invitation test email already has an account; choose a fresh test email.');
    }
    const organization = await OrganizationModel.findOne({
      name: 'InstituteOS Local QA',
      status: 'active',
    }).lean();
    if (!organization) throw new Error('Local QA organization not found.');
    const [campus, academicYear, academicClass] = await Promise.all([
      CampusModel.findOne({ organizationId: organization._id, name: 'Main Campus' }).lean(),
      AcademicYearModel.findOne({ organizationId: organization._id, name: '2026-27 Local QA' }).lean(),
      AcademicClassModel.findOne({ organizationId: organization._id, code: 'QA8' }).lean(),
    ]);
    if (!campus || !academicYear || !academicClass) {
      throw new Error('Local QA campus, academic year or class is missing.');
    }
    const [section, subject] = await Promise.all([
      AcademicSectionModel.findOne({
        organizationId: organization._id,
        classId: academicClass._id,
        name: 'A',
      }).lean(),
      SubjectModel.findOne({
        organizationId: organization._id,
        code: 'QAMATH',
      }).lean(),
    ]);
    if (!section || !subject) throw new Error('Local QA section or subject is missing.');

    const staff = await StaffMemberModel.findOneAndUpdate(
      { organizationId: organization._id, email },
      {
        $set: {
          firstName: 'Invitation',
          lastName: 'Teacher',
          designation: 'Teacher',
          department: 'Mathematics',
          subjects: ['Mathematics'],
          status: 'active',
          campusId: campus._id,
          userId: null,
        },
        $setOnInsert: { organizationId: organization._id, email },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
    if (!staff) throw new Error('Could not create the invitation staff profile.');

    await TeacherAssignmentModel.findOneAndUpdate(
      {
        organizationId: organization._id,
        teacherStaffId: staff._id,
        subjectId: subject._id,
        classId: academicClass._id,
        sectionId: section._id,
        academicYearId: academicYear._id,
      },
      {
        $setOnInsert: {
          organizationId: organization._id,
          teacherStaffId: staff._id,
          subjectId: subject._id,
          classId: academicClass._id,
          sectionId: section._id,
          academicYearId: academicYear._id,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );

    console.log('Invitation-only Teacher staff profile is ready.');
    console.log(`Email: ${email}`);
    console.log('No AuthUser or membership was created; registration and invitation acceptance remain to be tested in the browser.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Invitation profile seed failed.');
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
