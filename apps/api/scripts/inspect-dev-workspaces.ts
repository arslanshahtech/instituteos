import mongoose from 'mongoose';
import { AuthUserModel } from '../src/modules/auth/auth.model.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
  SubjectModel,
  TeacherAssignmentModel,
} from '../src/modules/academics/academics.model.js';
import { StudentSectionPlacementModel } from '../src/modules/attendance/attendance.model.js';
import { MongoAttendanceRepository } from '../src/modules/attendance/attendance.repository.js';
import {
  GuardianModel,
  StaffMemberModel,
  StudentGuardianLinkModel,
  StudentModel,
} from '../src/modules/people/people.model.js';
import {
  CampusModel,
  MembershipModel,
  OrganizationModel,
  PlatformRoleGrantModel,
} from '../src/modules/tenancy/tenancy.model.js';

const uri = process.env.DEV_SEED_MONGODB_URI;
if (!uri) throw new Error('DEV_SEED_MONGODB_URI is required.');
await mongoose.connect(uri, { readPreference: 'secondaryPreferred' });
if (mongoose.connection.name !== 'instituteos_dev') {
  await mongoose.disconnect();
  throw new Error('Refusing to inspect outside instituteos_dev.');
}

const names = {
  admin: 'admin@instituteos.test',
  teacher: 'teacher@instituteos.test',
  parent: 'parent@instituteos.test',
};

try {
  const [users, platformGrants] = await Promise.all([
    Promise.all(
      Object.values(names).map((email) =>
        AuthUserModel.findOne({ email }).lean(),
      ),
    ),
    PlatformRoleGrantModel.find({ status: 'active' }).lean(),
  ]);
  const [admin, teacher, parent] = users;
  if (!admin || !teacher || !parent)
    throw new Error('One or more local QA accounts are missing.');
  const adminMembership = await MembershipModel.findOne({
    userId: admin._id,
    status: 'active',
  }).lean();
  if (!adminMembership)
    throw new Error('Admin organization membership is missing.');
  const organizationId = adminMembership.organizationId;
  const organization = await OrganizationModel.findById(organizationId).lean();
  if (!organization) throw new Error('Local QA organization is missing.');

  const [teacherMembership, parentMembership, staff, guardian] =
    await Promise.all([
      MembershipModel.findOne({
        organizationId,
        userId: teacher._id,
        role: 'teacher',
        status: 'active',
      }).lean(),
      MembershipModel.findOne({
        organizationId,
        userId: parent._id,
        role: 'parent_guardian',
        status: 'active',
      }).lean(),
      StaffMemberModel.find({
        organizationId,
        userId: teacher._id,
        status: 'active',
      }).lean(),
      GuardianModel.findOne({ organizationId, email: parent.email }).lean(),
    ]);

  const repositoryTeacherAssignments =
    await new MongoAttendanceRepository().listTeacherAssignmentsForUser(
      String(organizationId),
      String(teacher._id),
    );
  const assignmentRows = staff.length
    ? await TeacherAssignmentModel.find({
        organizationId,
        teacherStaffId: { $in: staff.map((item) => item._id) },
      }).lean()
    : [];
  const [classCatalog, sectionCatalog] = await Promise.all([
    AcademicClassModel.find({ organizationId }).lean(),
    AcademicSectionModel.find({ organizationId }).lean(),
  ]);
  const campusCatalog = await CampusModel.find({
    organizationId,
    _id: { $in: classCatalog.map((item) => item.campusId) },
  }).lean();
  const [classes, sections, years, subjects] = await Promise.all([
    AcademicClassModel.find({
      organizationId,
      _id: { $in: assignmentRows.map((item) => item.classId) },
    }).lean(),
    AcademicSectionModel.find({
      organizationId,
      _id: { $in: assignmentRows.map((item) => item.sectionId) },
    }).lean(),
    AcademicYearModel.find({
      organizationId,
      _id: { $in: assignmentRows.map((item) => item.academicYearId) },
    }).lean(),
    SubjectModel.find({
      organizationId,
      _id: { $in: assignmentRows.map((item) => item.subjectId) },
    }).lean(),
  ]);
  const classById = new Map(
    classes.map((item) => [String(item._id), item.name]),
  );
  const classRecordById = new Map(
    classes.map((item) => [String(item._id), item]),
  );
  const sectionById = new Map(
    sections.map((item) => [String(item._id), item.name]),
  );
  const yearById = new Map(years.map((item) => [String(item._id), item.name]));
  const subjectById = new Map(
    subjects.map((item) => [String(item._id), item.name]),
  );

  const links = guardian
    ? await StudentGuardianLinkModel.find({
        organizationId,
        guardianId: guardian._id,
      }).lean()
    : [];
  const legacyStudents = guardian
    ? await StudentModel.find({
        organizationId,
        status: 'active',
        guardianIds: guardian._id,
      }).lean()
    : [];
  const linkedIds = new Set([
    ...links.map((item) => String(item.studentId)),
    ...legacyStudents.map((item) => String(item._id)),
  ]);
  const allActiveStudents = await StudentModel.find({
    organizationId,
    status: 'active',
  }).lean();
  const linkedStudents = linkedIds.size
    ? allActiveStudents.filter((item) => linkedIds.has(String(item._id)))
    : [];
  const unlinkedStudents = allActiveStudents.filter(
    (item) => !linkedIds.has(String(item._id)),
  );
  const childPlacements = linkedStudents.length
    ? await StudentSectionPlacementModel.find({
        organizationId,
        studentId: { $in: linkedStudents.map((item) => item._id) },
        status: 'active',
      }).lean()
    : [];
  const classNames = new Map(
    classCatalog.map((item) => [String(item._id), String(item.name)]),
  );
  const sectionNames = new Map(
    sectionCatalog.map((item) => [String(item._id), String(item.name)]),
  );
  const campusById = new Map(
    campusCatalog.map((item) => [String(item._id), item]),
  );
  const yearStatusById = new Map(
    years.map((item) => [String(item._id), String(item.status ?? 'unknown')]),
  );

  console.log(
    JSON.stringify(
      {
        database: mongoose.connection.name,
        organization: { name: organization.name, id: String(organization._id) },
        activePlatformAdmins: await Promise.all(
          platformGrants.map(async (grant) => {
            const user = await AuthUserModel.findById(grant.userId).lean();
            return {
              email: user?.email ?? 'Missing account',
              displayName: user?.displayName ?? 'Missing account',
              role: String(grant.role),
              accountStatus: user?.status ?? 'missing',
            };
          }),
        ),
        accounts: {
          admin: {
            displayName: admin.displayName,
            activeMembership: Boolean(adminMembership),
          },
          teacher: {
            displayName: teacher.displayName,
            activeMembership: Boolean(teacherMembership),
            campusIds: (teacherMembership?.campusIds ?? []).map(String),
          },
          parent: {
            displayName: parent.displayName,
            activeMembership: Boolean(parentMembership),
            campusIds: (parentMembership?.campusIds ?? []).map(String),
          },
        },
        teacherProfile: staff.map((item) => ({
          name: [item.firstName, item.lastName].filter(Boolean).join(' '),
          designation: item.designation ?? null,
          email: item.email ?? null,
        })),
        academicClasses: classCatalog.map((item) => ({
          name: String(item.name),
          status: String(item.status ?? 'active'),
          campus:
            campusById.get(String(item.campusId))?.name ?? 'Missing campus',
          campusId: String(item.campusId),
          campusStatus:
            campusById.get(String(item.campusId))?.status ?? 'missing',
          sections: sectionCatalog
            .filter((section) => String(section.classId) === String(item._id))
            .map((section) => String(section.name)),
        })),
        repositoryTeacherAssignments,
        teacherAssignments: assignmentRows.map((item) => ({
          class: classById.get(String(item.classId)) ?? 'Missing class',
          section: sectionById.get(String(item.sectionId)) ?? 'Missing section',
          subject: subjectById.get(String(item.subjectId)) ?? 'Missing subject',
          academicYear:
            yearById.get(String(item.academicYearId)) ?? 'Missing year',
          academicYearStatus:
            yearStatusById.get(String(item.academicYearId)) ?? 'missing',
          campus:
            campusById.get(
              String(classRecordById.get(String(item.classId))?.campusId ?? ''),
            )?.name ?? 'Missing campus',
          campusStatus:
            campusById.get(
              String(classRecordById.get(String(item.classId))?.campusId ?? ''),
            )?.status ?? 'missing',
          status: String(item.status ?? 'active'),
        })),
        guardianProfile: guardian
          ? {
              name: [guardian.firstName, guardian.lastName]
                .filter(Boolean)
                .join(' '),
              email: guardian.email,
            }
          : null,
        activeStudentCount: allActiveStudents.length,
        linkedChildrenCount: linkedStudents.length,
        linkedChildren: linkedStudents.map((item) => ({
          name: [item.firstName, item.lastName].filter(Boolean).join(' '),
          status: item.status,
        })),
        activeStudentsNotLinkedToThisParent: unlinkedStudents.map((item) =>
          [item.firstName, item.lastName].filter(Boolean).join(' '),
        ),
        linkedChildPlacements: childPlacements.map((item) => ({
          child: linkedStudents.find(
            (student) => String(student._id) === String(item.studentId),
          )
            ? [
                linkedStudents.find(
                  (student) => String(student._id) === String(item.studentId),
                )!.firstName,
                linkedStudents.find(
                  (student) => String(student._id) === String(item.studentId),
                )!.lastName,
              ]
                .filter(Boolean)
                .join(' ')
            : 'Unknown child',
          class: classNames.get(String(item.classId)) ?? 'Missing class',
          section:
            sectionNames.get(String(item.sectionId)) ?? 'Missing section',
        })),
        parentMembershipValid: Boolean(parentMembership && guardian),
      },
      null,
      2,
    ),
  );
} finally {
  await mongoose.disconnect();
}
