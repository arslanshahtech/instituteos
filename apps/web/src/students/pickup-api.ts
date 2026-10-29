import { apiRequest } from '../api/client.js';

const apiFetch = apiRequest;

export interface AuthorizedPickupPerson {
  id: string;
  fullName: string;
  relationship: string;
  phone: string;
  status: 'active' | 'suspended';
}

export interface PickupPass {
  id: string;
  passCode: string;
  validUntil: string;
  status: string;
}

export interface PickupLog {
  id: string;
  studentId: string;
  releasedAt: string;
  method: string;
}

export async function fetchPickupPersons(
  organizationId: string,
  studentId: string,
): Promise<{ items: AuthorizedPickupPerson[] }> {
  return apiFetch<{ items: AuthorizedPickupPerson[] }>(
    `/organizations/${encodeURIComponent(organizationId)}/pickup/students/${encodeURIComponent(studentId)}/persons`,
  );
}

export async function generateGatePass(
  organizationId: string,
  studentId: string,
  pickupPersonId: string,
): Promise<{ pass: PickupPass }> {
  return apiFetch<{ pass: PickupPass }>(
    `/organizations/${encodeURIComponent(organizationId)}/pickup/students/${encodeURIComponent(studentId)}/passes`,
    {
      method: 'POST',
      body: JSON.stringify({ pickupPersonId, validMinutes: 60 }),
    },
  );
}

export async function verifyAndRelease(
  organizationId: string,
  passCode: string,
): Promise<{ log: PickupLog; message: string }> {
  return apiFetch<{ log: PickupLog; message: string }>(
    `/organizations/${encodeURIComponent(organizationId)}/pickup/verify-release`,
    {
      method: 'POST',
      body: JSON.stringify({ passCode }),
    },
  );
}
