import { randomInt } from 'crypto';
import { AppError } from '../../errors/app-error.js';
import type { MongoPickupRepository } from './pickup.repository.js';
import type {
  CreatePickupPersonInput,
  CreatePickupPassInput,
  VerifyPickupInput,
  ManualOverridePickupInput,
  AuthorizedPickupPerson,
  PickupPass,
  PickupLog,
} from './pickup.types.js';

export class PickupService {
  constructor(private readonly repository: MongoPickupRepository) {}

  async registerPickupPerson(
    organizationId: string,
    studentId: string,
    input: CreatePickupPersonInput,
  ): Promise<AuthorizedPickupPerson> {
    return this.repository.createPickupPerson(organizationId, studentId, input);
  }

  async listPickupPersons(
    organizationId: string,
    studentId: string,
  ): Promise<AuthorizedPickupPerson[]> {
    return this.repository.listPickupPersonsByStudent(
      organizationId,
      studentId,
    );
  }

  async setPersonStatus(
    organizationId: string,
    personId: string,
    status: 'active' | 'suspended',
  ): Promise<AuthorizedPickupPerson> {
    const updated = await this.repository.updatePickupPersonStatus(
      organizationId,
      personId,
      status,
    );
    if (!updated) {
      throw new AppError(404, 'NOT_FOUND', 'Pickup person not found.');
    }
    return updated;
  }

  async generateGatePass(
    organizationId: string,
    studentId: string,
    userId: string,
    input: CreatePickupPassInput,
  ): Promise<PickupPass> {
    const person = await this.repository.findPickupPersonById(
      organizationId,
      input.pickupPersonId,
    );

    if (!person || person.studentId !== studentId) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Authorized pickup person does not belong to this student.',
      );
    }

    if (person.status !== 'active') {
      throw new AppError(
        400,
        'PERSON_SUSPENDED',
        'Cannot generate pass for a suspended pickup person.',
      );
    }

    // 6 digit secure code
    const passCode = randomInt(100000, 999999).toString();
    const now = new Date();
    const validMinutes =
      input.validMinutes && input.validMinutes > 0 ? input.validMinutes : 60;
    const expiry = new Date(now.getTime() + validMinutes * 60 * 1000);

    return this.repository.createPass(
      organizationId,
      studentId,
      person.id,
      passCode,
      now.toISOString(),
      expiry.toISOString(),
      userId,
    );
  }

  async verifyAndReleaseStudent(
    organizationId: string,
    staffId: string,
    input: VerifyPickupInput,
  ): Promise<PickupLog> {
    const pass = await this.repository.findActivePassByCode(
      organizationId,
      input.passCode.trim(),
    );

    if (!pass) {
      throw new AppError(404, 'INVALID_PASS', 'Invalid or expired pass code.');
    }

    const now = new Date();
    if (new Date(pass.validUntil) < now) {
      await this.repository.updatePassStatus(
        organizationId,
        pass.id,
        'expired',
      );
      throw new AppError(400, 'PASS_EXPIRED', 'This pass code has expired.');
    }

    const person = await this.repository.findPickupPersonById(
      organizationId,
      pass.pickupPersonId,
    );

    if (!person || person.status !== 'active') {
      throw new AppError(
        403,
        'PERSON_UNAUTHORIZED',
        'Pickup person authorization has been revoked or suspended.',
      );
    }

    // Pass use ho chuka hai, status badlein
    await this.repository.updatePassStatus(organizationId, pass.id, 'used');

    // Immutable release trail create karein
    return this.repository.createLog(organizationId, {
      studentId: pass.studentId,
      campusId: input.campusId,
      pickupPersonId: person.id,
      passId: pass.id,
      releasedByStaffId: staffId,
      releasedAt: now.toISOString(),
      method: 'digital_pass',
      notes: input.notes,
    });
  }

  async manualOverrideRelease(
    organizationId: string,
    staffId: string,
    input: ManualOverridePickupInput,
  ): Promise<PickupLog> {
    if (!input.overrideReason || input.overrideReason.trim().length < 5) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'A clear reason is required for manual pickup override.',
      );
    }

    return this.repository.createLog(organizationId, {
      studentId: input.studentId,
      campusId: input.campusId,
      pickupPersonId: input.pickupPersonId,
      releasedByStaffId: staffId,
      releasedAt: new Date().toISOString(),
      method: 'manual_override',
      overrideReason: input.overrideReason.trim(),
      notes: input.notes,
    });
  }

  async getStudentPickupHistory(
    organizationId: string,
    studentId: string,
  ): Promise<PickupLog[]> {
    return this.repository.listLogsByStudent(organizationId, studentId);
  }
}
