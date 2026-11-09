import { apiRequest } from '../api/client.js';
export interface SchoolEvent { id: string; title: string; type: 'holiday' | 'event'; noClasses: boolean; startDate: string; endDate: string; remarks: string; createdAt: string | null; }
export interface EventInput { title: string; type: 'holiday' | 'event'; noClasses: boolean; startDate: string; endDate: string; remarks: string; }
const path = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}/events-holidays`;
export function listSchoolEvents(organizationId: string) { return apiRequest<{ items: SchoolEvent[]; summary: { holidays: number; events: number; total: number; past: number } }>(path(organizationId)); }
export function saveSchoolEvent(organizationId: string, input: EventInput, id?: string) { return apiRequest<{ item: SchoolEvent }>(`${path(organizationId)}${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) }); }
export function deleteSchoolEvent(organizationId: string, id: string) { return apiRequest<void>(`${path(organizationId)}/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
