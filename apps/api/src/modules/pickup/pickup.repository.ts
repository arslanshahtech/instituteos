import {
  AuthorizedPickupPersonModel,
  PickupPassModel,
  PickupLogModel,
} from './pickup.model.js';
import type {
  AuthorizedPickupPerson,
  PickupPass,
  PickupLog,
  CreatePickupPersonInput,
  PickupPassStatus,
} from './pickup.types.js';

export class MongoPickupRepository {
  async createPickupPerson(
    organizationId: string,
    studentId: string,
    input: CreatePickupPersonInput,
  ): Promise<AuthorizedPickupPerson> {
    const doc = await AuthorizedPickupPersonModel.create({
      organizationId,
      studentId,
      ...input,
      status: 'active',
    });
    return this.mapPerson(doc);
  }

  async listPickupPersonsByStudent(
    organizationId: string,
    studentId: string,
  ): Promise<AuthorizedPickupPerson[]> {
    const docs = await AuthorizedPickupPersonModel.find({
      organizationId,
      studentId,
    }).sort({ createdAt: -1 });
    return docs.map((doc) => this.mapPerson(doc));
  }

  async findPickupPersonById(
    organizationId: string,
    personId: string,
  ): Promise<AuthorizedPickupPerson | null> {
    const doc = await AuthorizedPickupPersonModel.findOne({
      _id: personId,
      organizationId,
    });
    return doc ? this.mapPerson(doc) : null;
  }

  async updatePickupPersonStatus(
    organizationId: string,
    personId: string,
    status: 'active' | 'suspended',
  ): Promise<AuthorizedPickupPerson | null> {
    const doc = await AuthorizedPickupPersonModel.findOneAndUpdate(
      { _id: personId, organizationId },
      { $set: { status } },
      { new: true },
    );
    return doc ? this.mapPerson(doc) : null;
  }

  async createPass(
    organizationId: string,
    studentId: string,
    pickupPersonId: string,
    passCode: string,
    validFrom: string,
    validUntil: string,
    generatedByUserId: string,
  ): Promise<PickupPass> {
    const doc = await PickupPassModel.create({
      organizationId,
      studentId,
      pickupPersonId,
      passCode,
      validFrom,
      validUntil,
      status: 'active',
      generatedByUserId,
    });
    return this.mapPass(doc);
  }

  async findActivePassByCode(
    organizationId: string,
    passCode: string,
  ): Promise<PickupPass | null> {
    const doc = await PickupPassModel.findOne({
      organizationId,
      passCode,
      status: 'active',
    });
    return doc ? this.mapPass(doc) : null;
  }

  async updatePassStatus(
    organizationId: string,
    passId: string,
    status: PickupPassStatus,
  ): Promise<void> {
    await PickupPassModel.updateOne(
      { _id: passId, organizationId },
      { $set: { status } },
    );
  }

  async createLog(
    organizationId: string,
    log: Omit<PickupLog, 'id' | 'organizationId' | 'createdAt'>,
  ): Promise<PickupLog> {
    const doc = await PickupLogModel.create({
      organizationId,
      ...log,
    });
    return this.mapLog(doc);
  }

  async listLogsByStudent(
    organizationId: string,
    studentId: string,
    limit = 20,
  ): Promise<PickupLog[]> {
    const docs = await PickupLogModel.find({
      organizationId,
      studentId,
    })
      .sort({ releasedAt: -1 })
      .limit(limit);
    return docs.map((doc) => this.mapLog(doc));
  }

  private mapPerson(doc: any): AuthorizedPickupPerson {
    return {
      id: doc._id.toString(),
      organizationId: doc.organizationId,
      studentId: doc.studentId,
      fullName: doc.fullName,
      relationship: doc.relationship,
      cnic: doc.cnic,
      phone: doc.phone,
      photoUrl: doc.photoUrl,
      status: doc.status,
      notes: doc.notes,
      createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  private mapPass(doc: any): PickupPass {
    return {
      id: doc._id.toString(),
      organizationId: doc.organizationId,
      studentId: doc.studentId,
      pickupPersonId: doc.pickupPersonId,
      passCode: doc.passCode,
      validFrom: doc.validFrom,
      validUntil: doc.validUntil,
      status: doc.status,
      generatedByUserId: doc.generatedByUserId,
      createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  private mapLog(doc: any): PickupLog {
    return {
      id: doc._id.toString(),
      organizationId: doc.organizationId,
      campusId: doc.campusId,
      studentId: doc.studentId,
      pickupPersonId: doc.pickupPersonId,
      passId: doc.passId,
      releasedByStaffId: doc.releasedByStaffId,
      releasedAt: doc.releasedAt,
      method: doc.method,
      overrideReason: doc.overrideReason,
      notes: doc.notes,
      createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}