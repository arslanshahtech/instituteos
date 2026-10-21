export type StudentStatus = 'active' | 'inactive' | 'withdrawn';
export type GuardianRelationshipType =
  'father' | 'mother' | 'guardian' | 'other';
export type StaffStatus = 'active' | 'on_leave' | 'terminated' | 'inactive';
export type InquiryStatus =
  'new' | 'contacted' | 'qualified' | 'converted' | 'closed';
export type ApplicationStatus =
  'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'admitted';
export type EnrollmentStatus = 'active' | 'completed' | 'withdrawn';

export interface AddressInput {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface StudentInput {
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: string;
  status?: StudentStatus;
  contactEmail?: string;
  phone?: string;
  address?: AddressInput;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  academicHistory?: Array<{
    schoolName?: string;
    qualification?: string;
    year?: string;
    notes?: string;
  }>;
  campusId?: string;
  guardianIds?: string[];
}

export interface StudentRecord {
  id: string;
  organizationId: string;
  campusId?: string;
  sourceApplicationId?: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: string;
  status: StudentStatus;
  contactEmail?: string;
  phone?: string;
  address?: AddressInput;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  academicHistory?: Array<{
    schoolName?: string;
    qualification?: string;
    year?: string;
    notes?: string;
  }>;
  guardianIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GuardianInput {
  firstName: string;
  lastName: string;
  relationship?: GuardianRelationshipType;
  phone?: string;
  email?: string;
  communicationPreference?: 'sms' | 'email' | 'both';
  address?: AddressInput;
}

export interface GuardianRecord {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  relationship?: GuardianRelationshipType;
  phone?: string;
  email?: string;
  communicationPreference?: 'sms' | 'email' | 'both';
  address?: AddressInput;
  studentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GuardianLinkInput {
  studentId: string;
  guardianId: string;
  relationship: GuardianRelationshipType;
  isPrimary?: boolean;
}

export interface GuardianLinkRecord {
  id: string;
  organizationId: string;
  studentId: string;
  guardianId: string;
  relationship: GuardianRelationshipType;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PeopleAccessContext {
  organizationId: string;
  campusIds?: string[];
  role?: string;
}

export interface StudentGuardianRelation {
  id: string;
  relationship: GuardianRelationshipType;
  isPrimary: boolean;
  guardian: GuardianRecord;
}

export interface GuardianStudentRelation {
  id: string;
  relationship: GuardianRelationshipType;
  isPrimary: boolean;
  student: Pick<StudentRecord, 'id' | 'firstName' | 'lastName' | 'campusId'>;
}

export interface StaffInput {
  firstName: string;
  lastName: string;
  employeeCode?: string;
  department?: string;
  designation?: string;
  qualification?: string;
  qualifications?: string[];
  subjects?: string[];
  dateOfBirth?: string;
  gender?: string;
  status?: StaffStatus;
  role?: string;
  email?: string;
  phone?: string;
  campusId?: string;
}

export interface StaffRecord {
  id: string;
  organizationId: string;
  campusId?: string;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  department?: string;
  designation?: string;
  qualification?: string;
  qualifications?: string[];
  subjects?: string[];
  dateOfBirth?: string;
  gender?: string;
  status: StaffStatus;
  role?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InquiryInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: InquiryStatus;
  gradeLevelInterest?: string;
  notes?: string;
  campusId?: string;
}

export interface InquiryRecord {
  id: string;
  organizationId: string;
  campusId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  status: InquiryStatus;
  gradeLevelInterest?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationInput {
  inquiryId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  preferredCampusId?: string;
  program?: string;
  dateOfBirth?: string;
  guardianName?: string;
  guardianPhone?: string;
  feePlan?: 'Standard' | 'Scholarship' | 'Sibling plan';
  status?: ApplicationStatus;
  notes?: string;
}

export interface ApplicationRecord {
  id: string;
  organizationId: string;
  campusId?: string;
  inquiryId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  program?: string;
  dateOfBirth?: string;
  guardianName?: string;
  guardianPhone?: string;
  feePlan?: 'Standard' | 'Scholarship' | 'Sibling plan';
  status: ApplicationStatus;
  convertedStudentId?: string;
  notes?: string;
  decisionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentInput {
  studentId: string;
  campusId?: string;
  gradeLevel?: string;
  startDate?: string;
  endDate?: string;
  status?: EnrollmentStatus;
}

export interface EnrollmentRecord {
  id: string;
  organizationId: string;
  studentId: string;
  campusId?: string;
  sourceApplicationId?: string;
  gradeLevel?: string;
  startDate?: string;
  endDate?: string;
  status: EnrollmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudentListQuery {
  organizationId: string;
  campusId?: string;
  campusIds?: string[];
  search?: string;
  status?: StudentStatus;
  page?: number;
  pageSize?: number;
}

export interface QuerySummary<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PeopleRepository {
  listStudents(query: StudentListQuery): Promise<QuerySummary<StudentRecord>>;
  getStudent(
    organizationId: string,
    studentId: string,
  ): Promise<StudentRecord | null>;
  createStudent(
    organizationId: string,
    input: StudentInput,
  ): Promise<StudentRecord>;
  updateStudent(
    organizationId: string,
    studentId: string,
    changes: Partial<StudentInput>,
  ): Promise<StudentRecord | null>;

  listGuardians(
    organizationId: string,
    query?: {
      search?: string;
      page?: number;
      pageSize?: number;
      guardianIds?: string[];
    },
  ): Promise<QuerySummary<GuardianRecord>>;
  getGuardian(
    organizationId: string,
    guardianId: string,
  ): Promise<GuardianRecord | null>;
  createGuardian(
    organizationId: string,
    input: GuardianInput,
  ): Promise<GuardianRecord>;
  updateGuardian(
    organizationId: string,
    guardianId: string,
    changes: Partial<GuardianInput>,
  ): Promise<GuardianRecord | null>;
  createGuardianWithLink(
    organizationId: string,
    input: GuardianInput,
    link: Omit<GuardianLinkInput, 'guardianId'>,
  ): Promise<GuardianRecord>;
  linkGuardianToStudent(
    organizationId: string,
    input: GuardianLinkInput,
  ): Promise<GuardianLinkRecord>;
  listGuardianLinks(
    organizationId: string,
    studentId?: string,
    guardianId?: string,
    campusIds?: string[],
  ): Promise<GuardianLinkRecord[]>;
  unlinkGuardianFromStudent(
    organizationId: string,
    studentId: string,
    guardianId: string,
  ): Promise<boolean>;

  listStaff(
    organizationId: string,
    query?: {
      status?: string;
      department?: string;
      campusId?: string;
      search?: string;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<StaffRecord>>;
  getStaff(
    organizationId: string,
    staffId: string,
  ): Promise<StaffRecord | null>;
  createStaff(organizationId: string, input: StaffInput): Promise<StaffRecord>;
  updateStaff(
    organizationId: string,
    staffId: string,
    changes: Partial<StaffInput>,
  ): Promise<StaffRecord | null>;

  getInquiry(
    organizationId: string,
    inquiryId: string,
  ): Promise<InquiryRecord | null>;
  listInquiries(
    organizationId: string,
    query?: {
      status?: InquiryStatus;
      campusIds?: string[];
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<InquiryRecord>>;
  createInquiry(
    organizationId: string,
    input: InquiryInput,
  ): Promise<InquiryRecord>;
  updateInquiry(
    organizationId: string,
    inquiryId: string,
    changes: Partial<InquiryInput>,
  ): Promise<InquiryRecord | null>;

  listApplications(
    organizationId: string,
    query?: {
      status?: ApplicationStatus;
      campusIds?: string[];
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<ApplicationRecord>>;
  getApplication(
    organizationId: string,
    applicationId: string,
  ): Promise<ApplicationRecord | null>;
  createApplication(
    organizationId: string,
    input: ApplicationInput,
  ): Promise<ApplicationRecord>;
  updateApplication(
    organizationId: string,
    applicationId: string,
    changes: Partial<ApplicationInput>,
  ): Promise<ApplicationRecord | null>;
  approveApplication(
    organizationId: string,
    applicationId: string,
    decisionReason?: string,
    campusId?: string,
  ): Promise<{
    application: ApplicationRecord;
    student: StudentRecord;
    enrollment: EnrollmentRecord;
  }>;
}

export interface PeopleServices {
  listStudents(
    context: { organizationId: string; campusIds?: string[] },
    input: {
      search?: string;
      status?: StudentStatus;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<StudentRecord>>;
  createStudent(
    organizationId: string,
    input: StudentInput,
  ): Promise<StudentRecord>;
  getStudent(organizationId: string, studentId: string): Promise<StudentRecord>;
  updateStudent(
    organizationId: string,
    studentId: string,
    changes: Partial<StudentInput>,
  ): Promise<StudentRecord>;

  listGuardians(
    context: PeopleAccessContext,
    input?: { search?: string; page?: number; pageSize?: number },
  ): Promise<QuerySummary<GuardianRecord>>;
  createGuardian(
    organizationId: string,
    input: GuardianInput,
    context?: PeopleAccessContext,
    studentId?: string,
  ): Promise<GuardianRecord>;
  getGuardian(
    context: PeopleAccessContext,
    guardianId: string,
  ): Promise<{ guardian: GuardianRecord; students: GuardianStudentRelation[] }>;
  updateGuardian(
    context: PeopleAccessContext,
    guardianId: string,
    changes: Partial<GuardianInput>,
  ): Promise<GuardianRecord>;
  listStudentGuardians(
    context: PeopleAccessContext,
    studentId: string,
  ): Promise<StudentGuardianRelation[]>;
  linkGuardianToStudent(
    context: PeopleAccessContext,
    input: GuardianLinkInput,
  ): Promise<GuardianLinkRecord>;
  unlinkGuardianFromStudent(
    context: PeopleAccessContext,
    studentId: string,
    guardianId: string,
  ): Promise<void>;

  listStaff(
    organizationId: string,
    input?: {
      status?: string;
      department?: string;
      campusId?: string;
      search?: string;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<StaffRecord>>;
  createStaff(organizationId: string, input: StaffInput): Promise<StaffRecord>;
  updateStaff(
    organizationId: string,
    staffId: string,
    changes: Partial<StaffInput>,
  ): Promise<StaffRecord>;

  getInquiry(organizationId: string, inquiryId: string): Promise<InquiryRecord>;
  listInquiries(
    organizationId: string,
    input?: {
      status?: InquiryStatus;
      campusIds?: string[];
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<InquiryRecord>>;
  createInquiry(
    organizationId: string,
    input: InquiryInput,
  ): Promise<InquiryRecord>;
  updateInquiry(
    organizationId: string,
    inquiryId: string,
    changes: Partial<InquiryInput>,
  ): Promise<InquiryRecord>;

  listApplications(
    organizationId: string,
    input?: {
      status?: ApplicationStatus;
      campusIds?: string[];
      page?: number;
      pageSize?: number;
    },
  ): Promise<QuerySummary<ApplicationRecord>>;
  createApplication(
    organizationId: string,
    input: ApplicationInput,
  ): Promise<ApplicationRecord>;
  reviewApplication(
    organizationId: string,
    applicationId: string,
    input: { status: ApplicationStatus; decisionReason?: string; campusId?: string },
  ): Promise<{
    application: ApplicationRecord;
    student?: StudentRecord;
    enrollment?: EnrollmentRecord;
  }>;
}
