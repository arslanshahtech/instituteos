import mongoose, { Schema } from 'mongoose';

const auditLogSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    campusId: {
      type: Schema.Types.ObjectId,
      ref: 'Campus',
      index: true,
    },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, campusId: 1, createdAt: -1 });

export const AuditLogModel =
  mongoose.models.AuditLog ?? mongoose.model('AuditLog', auditLogSchema);
