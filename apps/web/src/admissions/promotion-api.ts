import { apiRequest } from '../api/client.js';

export interface PromotionPreview {
  sourceAcademicYear: { id: string; name: string };
  targetAcademicYear: { id: string; name: string };
  classes: Array<{
    id: string;
    name: string;
    code: string;
    campusId: string;
    studyLevel?: string;
    sortOrder?: number;
  }>;
  sections: Array<{
    id: string;
    name: string;
    classId: string;
    capacity?: number;
  }>;
  feeStructures: Array<{
    id: string;
    name: string;
    classId: string;
    total: number;
    feeHeads: Array<{ title: string; amount: number; isOptional: boolean }>;
  }>;
  students: Array<{
    id: string;
    firstName: string;
    lastName: string;
    registrationNumber: string;
    sourceClassId: string;
    sourceClassName: string;
    sourceClassCode: string;
    sourceSectionId: string;
    sourceSectionName: string;
    unpaidInvoiceCount: number;
    outstandingBalance: number;
    currentFee: number;
  }>;
}
export interface PromotionMapping {
  sourceClassId: string;
  sourceSectionId?: string;
  outcome: 'promoted' | 'repeated' | 'graduated';
  targetClassId?: string;
  targetSectionId?: string;
  feeStructureId?: string;
}
export interface PromotionPayload {
  sourceAcademicYearId: string;
  targetAcademicYearId: string;
  campusId: string;
  effectiveDate: string;
  studentIds: string[];
  mappings: PromotionMapping[];
  studentFeeOverrides?: Array<{
    studentId: string;
    mode: 'current' | 'custom';
    amount: number;
  }>;
}
export interface PromotionHistoryItem {
  id: string;
  sourceAcademicYearId: string;
  targetAcademicYearId: string;
  effectiveDate: string;
  promotedCount: number;
  graduatedCount: number;
  total: number;
  createdAt: string;
}
const path = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;
export function getPromotionSourceCount(
  organizationId: string,
  input: { sourceAcademicYearId: string; campusId: string },
) {
  const query = new URLSearchParams(input);
  return apiRequest<{ count: number }>(
    `${path(organizationId)}/promotions/source-count?${query}`,
  );
}
export function getPromotionPreview(
  organizationId: string,
  input: {
    sourceAcademicYearId: string;
    targetAcademicYearId: string;
    campusId: string;
  },
) {
  const query = new URLSearchParams(input);
  return apiRequest<PromotionPreview>(
    `${path(organizationId)}/promotions/preview?${query}`,
  );
}
export function executePromotion(
  organizationId: string,
  input: PromotionPayload,
) {
  return apiRequest<{
    promotion: {
      id: string;
      promotedCount: number;
      graduatedCount: number;
      total: number;
    };
  }>(`${path(organizationId)}/promotions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export function listPromotionHistory(organizationId: string) {
  return apiRequest<{ items: PromotionHistoryItem[] }>(
    `${path(organizationId)}/promotions/history`,
  );
}
