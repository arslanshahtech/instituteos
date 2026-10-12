export interface AuditLogInput {
  organizationId: string;
  campusId?: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export interface AuditLogRecord extends AuditLogInput {
  id: string;
  createdAt: string;
}
