import { apiRequest } from '../api/client.js';

export type HomeworkTestType = 'homework' | 'test';
export type HomeworkTestStatus = 'draft' | 'published' | 'archived';

export interface HomeworkTestRecord {
  id: string;
  organizationId: string;
  campusId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  title: string;
  instructions: string;
  type: HomeworkTestType;
  dueDate: string;
  totalMarks?: number;
  status: HomeworkTestStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  campusName: string;
  className: string;
  sectionName: string;
  subjectName: string;
  academicYearName: string;
}

export interface HomeworkTestInput {
  campusId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  title: string;
  instructions: string;
  type: HomeworkTestType;
  dueDate: string;
  totalMarks?: number;
  status?: HomeworkTestStatus;
}

const path = (orgId: string) =>
  `/organizations/${encodeURIComponent(orgId)}/homework-tests`;

export function listHomeworkTests(orgId: string) {
  return apiRequest<{ items: HomeworkTestRecord[] }>(path(orgId));
}

export function createHomeworkTest(orgId: string, input: HomeworkTestInput) {
  return apiRequest<{ item: HomeworkTestRecord }>(path(orgId), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateHomeworkTestStatus(
  orgId: string,
  id: string,
  status: HomeworkTestStatus,
) {
  return apiRequest<{ id: string; status: HomeworkTestStatus }>(
    `${path(orgId)}/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );
}

export function deleteHomeworkTest(orgId: string, id: string) {
  return apiRequest<void>(`${path(orgId)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
