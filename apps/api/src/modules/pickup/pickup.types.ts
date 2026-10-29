export type PickupPersonRelationship =
  | 'father'
  | 'mother'
  | 'brother'
  | 'sister'
  | 'grandparent'
  | 'driver'
  | 'other';

export type PickupPersonStatus = 'active' | 'suspended';

export type PickupPassStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface AuthorizedPickupPerson {
  id: string;
  organizationId: string;
  studentId: string;
  fullName: string;
  relationship: PickupPersonRelationship;
  cnic?: string;
  phone: string;
  photoUrl?: string;
  status: PickupPersonStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PickupPass {
  id: string;
  organizationId: string;
  studentId: string;
  pickupPersonId: string;
  passCode: string; // 6-digit PIN or short token
  validFrom: string;
  validUntil: string;
  status: PickupPassStatus;
  generatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PickupLog {
  id: string;
  organizationId: string;
  campusId?: string;
  studentId: string;
  pickupPersonId?: string;
  passId?: string;
  releasedByStaffId: string;
  releasedAt: string;
  method: 'digital_pass' | 'manual_override';
  overrideReason?: string;
  notes?: string;
  createdAt: string;
}

export interface CreatePickupPersonInput {
  fullName: string;
  relationship: PickupPersonRelationship;
  cnic?: string;
  phone: string;
  photoUrl?: string;
  notes?: string;
}

export interface CreatePickupPassInput {
  pickupPersonId: string;
  validMinutes?: number; // Default e.g. 60 mins
}

export interface VerifyPickupInput {
  passCode: string;
  pickupPersonId?: string;
  campusId?: string;
  notes?: string;
}

export interface ManualOverridePickupInput {
  studentId: string;
  pickupPersonId?: string;
  campusId?: string;
  overrideReason: string;
  notes?: string;
}
