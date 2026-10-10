import { Types } from 'mongoose';
import { AppError } from '../../errors/app-error.js';
import { CampusModel } from '../tenancy/tenancy.model.js';
import { StaffMemberModel } from '../people/people.model.js';
import {
  AcademicClassModel,
  AcademicSectionModel,
  AcademicYearModel,
  SubjectModel,
  TeacherAssignmentModel,
  TermModel,
} from './academics.model.js';
import type {
  AcademicYearInput,
  AcademicYearRecord,
  AcademicCampusChoice,
  AcademicsRepository,
  ClassInput,
  ClassRecord,
  SectionInput,
  SectionRecord,
  SubjectInput,
  SubjectRecord,
  TeacherAssignmentInput,
  TeacherAssignmentRecord,
  TermInput,
  TermRecord,
} from './academics.types.js';

const oid = (id: string) => new Types.ObjectId(id);
const timestamp = (value: Date) => new Date(value).toISOString();

function scopedCampusFilter(campusIds?: string[]): Record<string, unknown> {
  return campusIds === undefined
    ? {}
    : { campusId: { $in: campusIds.map(oid) } };
}

function yearRecord(record: Record<string, unknown>): AcademicYearRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    name: String(record.name),
    startDate: new Date(record.startDate as Date).toISOString().slice(0, 10),
    endDate: new Date(record.endDate as Date).toISOString().slice(0, 10),
    status: record.status === 'archived' ? 'archived' : 'active',
    createdAt: timestamp(record.createdAt as Date),
    updatedAt: timestamp(record.updatedAt as Date),
  };
}

function termRecord(record: Record<string, unknown>): TermRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    name: String(record.name),
    academicYearId: String(record.academicYearId),
    startDate: new Date(record.startDate as Date).toISOString().slice(0, 10),
    endDate: new Date(record.endDate as Date).toISOString().slice(0, 10),
    createdAt: timestamp(record.createdAt as Date),
    updatedAt: timestamp(record.updatedAt as Date),
  };
}

function classRecord(record: Record<string, unknown>): ClassRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    campusId: String(record.campusId),
    name: String(record.name),
    code: String(record.code),
    createdAt: timestamp(record.createdAt as Date),
    updatedAt: timestamp(record.updatedAt as Date),
  };
}

function sectionRecord(record: Record<string, unknown>): SectionRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    classId: String(record.classId),
    name: String(record.name),
    ...(typeof record.capacity === 'number'
      ? { capacity: record.capacity }
      : {}),
    createdAt: timestamp(record.createdAt as Date),
    updatedAt: timestamp(record.updatedAt as Date),
  };
}

function subjectRecord(record: Record<string, unknown>): SubjectRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    name: String(record.name),
    code: String(record.code),
    ...(record.department ? { department: String(record.department) } : {}),
    createdAt: timestamp(record.createdAt as Date),
    updatedAt: timestamp(record.updatedAt as Date),
  };
}

function assignmentRecord(
  record: Record<string, unknown>,
): TeacherAssignmentRecord {
  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    teacherStaffId: String(record.teacherStaffId),
    subjectId: String(record.subjectId),
    classId: String(record.classId),
    sectionId: String(record.sectionId),
    academicYearId: String(record.academicYearId),
    createdAt: timestamp(record.createdAt as Date),
    updatedAt: timestamp(record.updatedAt as Date),
  };
}

function dates<T extends { startDate: string; endDate: string }>(input: T) {
  return {
    ...input,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
  };
}

export class MongoAcademicsRepository implements AcademicsRepository {
  async listCampuses(
    organizationId: string,
    campusIds?: string[],
  ): Promise<AcademicCampusChoice[]> {
    const campuses = await CampusModel.find({
      organizationId: oid(organizationId),
      status: 'active',
      ...(campusIds === undefined ? {} : { _id: { $in: campusIds.map(oid) } }),
    })
      .sort({ name: 1 })
      .select({ _id: 1, name: 1 })
      .lean();
    return campuses.map((campus) => ({
      id: String(campus._id),
      name: String(campus.name),
    }));
  }

  async listAcademicYears(
    organizationId: string,
  ): Promise<AcademicYearRecord[]> {
    const records = await AcademicYearModel.find({
      organizationId: oid(organizationId),
    })
      .sort({ startDate: -1 })
      .lean();
    return records.map((record) => yearRecord(record));
  }
  async getAcademicYear(
    organizationId: string,
    id: string,
  ): Promise<AcademicYearRecord | null> {
    const record = await AcademicYearModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    }).lean();
    return record ? yearRecord(record) : null;
  }
  async termsFitAcademicYear(
    organizationId: string,
    id: string,
    startDate: string,
    endDate: string,
  ): Promise<boolean> {
    const outsideYear = await TermModel.exists({
      organizationId: oid(organizationId),
      academicYearId: oid(id),
      $or: [
        { startDate: { $lt: new Date(startDate) } },
        { endDate: { $gt: new Date(endDate) } },
      ],
    });
    return !outsideYear;
  }
  async createAcademicYear(
    organizationId: string,
    input: AcademicYearInput,
  ): Promise<AcademicYearRecord> {
    try {
      const record = await AcademicYearModel.create({
        organizationId: oid(organizationId),
        ...dates(input),
      });
      return this.created(
        this.getAcademicYear(organizationId, String(record._id)),
        'Academic year',
      );
    } catch (error) {
      this.uniqueConflict(
        error,
        'An academic year with this name already exists.',
      );
      throw error;
    }
  }
  async updateAcademicYear(
    organizationId: string,
    id: string,
    input: Partial<AcademicYearInput>,
  ): Promise<AcademicYearRecord | null> {
    try {
      const changes: Record<string, unknown> = { ...input };
      if (typeof changes.startDate === 'string')
        changes.startDate = new Date(changes.startDate);
      if (typeof changes.endDate === 'string')
        changes.endDate = new Date(changes.endDate);
      const record = await AcademicYearModel.findOneAndUpdate(
        { _id: oid(id), organizationId: oid(organizationId) },
        { $set: changes },
        { new: true, runValidators: true },
      ).lean();
      return record ? yearRecord(record) : null;
    } catch (error) {
      this.uniqueConflict(
        error,
        'An academic year with this name already exists.',
      );
      throw error;
    }
  }
  async deleteAcademicYear(
    organizationId: string,
    id: string,
  ): Promise<boolean> {
    return Boolean(
      await AcademicYearModel.findOneAndDelete({
        _id: oid(id),
        organizationId: oid(organizationId),
      }),
    );
  }

  async listTerms(
    organizationId: string,
    academicYearId?: string,
  ): Promise<TermRecord[]> {
    const filter: Record<string, unknown> = {
      organizationId: oid(organizationId),
    };
    if (academicYearId) filter.academicYearId = oid(academicYearId);
    const records = await TermModel.find(filter).sort({ startDate: 1 }).lean();
    return records.map((record) => termRecord(record));
  }
  async getTerm(
    organizationId: string,
    id: string,
  ): Promise<TermRecord | null> {
    const record = await TermModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    }).lean();
    return record ? termRecord(record) : null;
  }
  async createTerm(
    organizationId: string,
    input: TermInput,
  ): Promise<TermRecord> {
    try {
      const record = await TermModel.create({
        organizationId: oid(organizationId),
        ...dates(input),
        academicYearId: oid(input.academicYearId),
      });
      return this.created(
        this.getTerm(organizationId, String(record._id)),
        'Term',
      );
    } catch (error) {
      this.uniqueConflict(
        error,
        'A term with this name already exists in the academic year.',
      );
      throw error;
    }
  }
  async updateTerm(
    organizationId: string,
    id: string,
    input: Partial<TermInput>,
  ): Promise<TermRecord | null> {
    try {
      const changes: Record<string, unknown> = { ...input };
      if (input.academicYearId !== undefined)
        changes.academicYearId = oid(input.academicYearId);
      if (input.startDate !== undefined)
        changes.startDate = new Date(input.startDate);
      if (input.endDate !== undefined)
        changes.endDate = new Date(input.endDate);
      const record = await TermModel.findOneAndUpdate(
        { _id: oid(id), organizationId: oid(organizationId) },
        { $set: changes },
        { new: true, runValidators: true },
      ).lean();
      return record ? termRecord(record) : null;
    } catch (error) {
      this.uniqueConflict(
        error,
        'A term with this name already exists in the academic year.',
      );
      throw error;
    }
  }
  async deleteTerm(organizationId: string, id: string): Promise<boolean> {
    return Boolean(
      await TermModel.findOneAndDelete({
        _id: oid(id),
        organizationId: oid(organizationId),
      }),
    );
  }

  async listClasses(
    organizationId: string,
    campusIds?: string[],
  ): Promise<ClassRecord[]> {
    const records = await AcademicClassModel.find({
      organizationId: oid(organizationId),
      ...scopedCampusFilter(campusIds),
    })
      .sort({ name: 1 })
      .lean();
    return records.map((record) => classRecord(record));
  }
  async getClass(
    organizationId: string,
    id: string,
    campusIds?: string[],
  ): Promise<ClassRecord | null> {
    const record = await AcademicClassModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
      ...scopedCampusFilter(campusIds),
    }).lean();
    return record ? classRecord(record) : null;
  }
  async createClass(
    organizationId: string,
    input: ClassInput,
  ): Promise<ClassRecord> {
    if (
      !(await CampusModel.exists({
        _id: oid(input.campusId),
        organizationId: oid(organizationId),
        status: 'active',
      }))
    ) {
      throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    }
    try {
      const record = await AcademicClassModel.create({
        ...input,
        organizationId: oid(organizationId),
        campusId: oid(input.campusId),
      });
      return this.created(
        this.getClass(organizationId, String(record._id)),
        'Class',
      );
    } catch (error) {
      this.uniqueConflict(
        error,
        'A class with this code already exists at this campus.',
      );
      throw error;
    }
  }
  async updateClass(
    organizationId: string,
    id: string,
    input: Partial<ClassInput>,
  ): Promise<ClassRecord | null> {
    if (
      input.campusId &&
      !(await CampusModel.exists({
        _id: oid(input.campusId),
        organizationId: oid(organizationId),
        status: 'active',
      }))
    ) {
      throw new AppError(404, 'CAMPUS_NOT_FOUND', 'Campus not found.');
    }
    try {
      const changes = {
        ...input,
        ...(input.campusId ? { campusId: oid(input.campusId) } : {}),
      };
      const record = await AcademicClassModel.findOneAndUpdate(
        { _id: oid(id), organizationId: oid(organizationId) },
        { $set: changes },
        { new: true, runValidators: true },
      ).lean();
      return record ? classRecord(record) : null;
    } catch (error) {
      this.uniqueConflict(
        error,
        'A class with this code already exists at this campus.',
      );
      throw error;
    }
  }
  async deleteClass(organizationId: string, id: string): Promise<boolean> {
    return Boolean(
      await AcademicClassModel.findOneAndDelete({
        _id: oid(id),
        organizationId: oid(organizationId),
      }),
    );
  }

  async listSections(
    organizationId: string,
    classId?: string,
    campusIds?: string[],
  ): Promise<SectionRecord[]> {
    const classes = await AcademicClassModel.find({
      organizationId: oid(organizationId),
      ...scopedCampusFilter(campusIds),
      ...(classId ? { _id: oid(classId) } : {}),
    })
      .select({ _id: 1 })
      .lean();
    const records = await AcademicSectionModel.find({
      organizationId: oid(organizationId),
      classId: { $in: classes.map((record) => record._id) },
    })
      .sort({ name: 1 })
      .lean();
    return records.map((record) => sectionRecord(record));
  }
  async getSection(
    organizationId: string,
    id: string,
    campusIds?: string[],
  ): Promise<SectionRecord | null> {
    const record = await AcademicSectionModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    }).lean();
    if (
      !record ||
      !(await this.getClass(organizationId, String(record.classId), campusIds))
    )
      return null;
    return sectionRecord(record);
  }
  async createSection(
    organizationId: string,
    input: SectionInput,
  ): Promise<SectionRecord> {
    if (
      !(await AcademicClassModel.exists({
        _id: oid(input.classId),
        organizationId: oid(organizationId),
      }))
    ) {
      throw new AppError(404, 'CLASS_NOT_FOUND', 'Class not found.');
    }
    try {
      const record = await AcademicSectionModel.create({
        ...input,
        organizationId: oid(organizationId),
        classId: oid(input.classId),
      });
      return this.created(
        this.getSection(organizationId, String(record._id)),
        'Section',
      );
    } catch (error) {
      this.uniqueConflict(
        error,
        'A section with this name already exists in the class.',
      );
      throw error;
    }
  }
  async updateSection(
    organizationId: string,
    id: string,
    input: Partial<SectionInput>,
  ): Promise<SectionRecord | null> {
    if (
      input.classId &&
      !(await AcademicClassModel.exists({
        _id: oid(input.classId),
        organizationId: oid(organizationId),
      }))
    ) {
      throw new AppError(404, 'CLASS_NOT_FOUND', 'Class not found.');
    }
    try {
      const changes: Record<string, unknown> = {
        ...input,
        ...(input.classId ? { classId: oid(input.classId) } : {}),
      };
      const update: Record<string, unknown> = { $set: changes };
      if (input.capacity === null) {
        delete changes.capacity;
        update.$unset = { capacity: 1 };
      }
      const record = await AcademicSectionModel.findOneAndUpdate(
        { _id: oid(id), organizationId: oid(organizationId) },
        update,
        { new: true, runValidators: true },
      ).lean();
      return record ? sectionRecord(record) : null;
    } catch (error) {
      this.uniqueConflict(
        error,
        'A section with this name already exists in the class.',
      );
      throw error;
    }
  }
  async deleteSection(organizationId: string, id: string): Promise<boolean> {
    return Boolean(
      await AcademicSectionModel.findOneAndDelete({
        _id: oid(id),
        organizationId: oid(organizationId),
      }),
    );
  }

  async listSubjects(organizationId: string): Promise<SubjectRecord[]> {
    const records = await SubjectModel.find({
      organizationId: oid(organizationId),
    })
      .sort({ name: 1 })
      .lean();
    return records.map((record) => subjectRecord(record));
  }
  async getSubject(
    organizationId: string,
    id: string,
  ): Promise<SubjectRecord | null> {
    const record = await SubjectModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    }).lean();
    return record ? subjectRecord(record) : null;
  }
  async createSubject(
    organizationId: string,
    input: SubjectInput,
  ): Promise<SubjectRecord> {
    try {
      const record = await SubjectModel.create({
        ...input,
        organizationId: oid(organizationId),
      });
      return this.created(
        this.getSubject(organizationId, String(record._id)),
        'Subject',
      );
    } catch (error) {
      this.uniqueConflict(error, 'A subject with this code already exists.');
      throw error;
    }
  }
  async updateSubject(
    organizationId: string,
    id: string,
    input: Partial<SubjectInput>,
  ): Promise<SubjectRecord | null> {
    try {
      const record = await SubjectModel.findOneAndUpdate(
        { _id: oid(id), organizationId: oid(organizationId) },
        { $set: input },
        { new: true, runValidators: true },
      ).lean();
      return record ? subjectRecord(record) : null;
    } catch (error) {
      this.uniqueConflict(error, 'A subject with this code already exists.');
      throw error;
    }
  }
  async deleteSubject(organizationId: string, id: string): Promise<boolean> {
    return Boolean(
      await SubjectModel.findOneAndDelete({
        _id: oid(id),
        organizationId: oid(organizationId),
      }),
    );
  }

  async listTeacherAssignments(
    organizationId: string,
    campusIds?: string[],
  ): Promise<TeacherAssignmentRecord[]> {
    const classes = await AcademicClassModel.find({
      organizationId: oid(organizationId),
      ...scopedCampusFilter(campusIds),
    })
      .select({ _id: 1 })
      .lean();
    const records = await TeacherAssignmentModel.find({
      organizationId: oid(organizationId),
      classId: { $in: classes.map((record) => record._id) },
    })
      .sort({ createdAt: -1 })
      .lean();
    return records.map((record) => assignmentRecord(record));
  }
  async getTeacherAssignment(
    organizationId: string,
    id: string,
    campusIds?: string[],
  ): Promise<TeacherAssignmentRecord | null> {
    const record = await TeacherAssignmentModel.findOne({
      _id: oid(id),
      organizationId: oid(organizationId),
    }).lean();
    if (
      !record ||
      !(await this.getClass(organizationId, String(record.classId), campusIds))
    )
      return null;
    return assignmentRecord(record);
  }
  async findTeacherAssignmentConflict(
    organizationId: string,
    input: TeacherAssignmentInput,
    exceptId?: string,
  ): Promise<boolean> {
    const filter: Record<string, unknown> = {
      organizationId: oid(organizationId),
      teacherStaffId: oid(input.teacherStaffId),
      classId: oid(input.classId),
      sectionId: oid(input.sectionId),
      academicYearId: oid(input.academicYearId),
    };
    if (exceptId) filter._id = { $ne: oid(exceptId) };
    return Boolean(await TeacherAssignmentModel.exists(filter));
  }
  async createTeacherAssignment(
    organizationId: string,
    input: TeacherAssignmentInput,
  ): Promise<TeacherAssignmentRecord> {
    try {
      const record = await TeacherAssignmentModel.create({
        ...input,
        organizationId: oid(organizationId),
        teacherStaffId: oid(input.teacherStaffId),
        subjectId: oid(input.subjectId),
        classId: oid(input.classId),
        sectionId: oid(input.sectionId),
        academicYearId: oid(input.academicYearId),
      });
      return this.created(
        this.getTeacherAssignment(organizationId, String(record._id)),
        'Teacher assignment',
      );
    } catch (error) {
      this.teacherConflict(error);
      throw error;
    }
  }
  async updateTeacherAssignment(
    organizationId: string,
    id: string,
    input: TeacherAssignmentInput,
  ): Promise<TeacherAssignmentRecord | null> {
    try {
      const record = await TeacherAssignmentModel.findOneAndUpdate(
        { _id: oid(id), organizationId: oid(organizationId) },
        {
          $set: {
            ...input,
            teacherStaffId: oid(input.teacherStaffId),
            subjectId: oid(input.subjectId),
            classId: oid(input.classId),
            sectionId: oid(input.sectionId),
            academicYearId: oid(input.academicYearId),
          },
        },
        { new: true, runValidators: true },
      ).lean();
      return record ? assignmentRecord(record) : null;
    } catch (error) {
      this.teacherConflict(error);
      throw error;
    }
  }
  async deleteTeacherAssignment(
    organizationId: string,
    id: string,
  ): Promise<boolean> {
    return Boolean(
      await TeacherAssignmentModel.findOneAndDelete({
        _id: oid(id),
        organizationId: oid(organizationId),
      }),
    );
  }

  async hasReference(
    organizationId: string,
    resource: 'academicYear' | 'class' | 'section' | 'subject',
    id: string,
  ): Promise<boolean> {
    const organization = oid(organizationId);
    const value = oid(id);
    switch (resource) {
      case 'academicYear':
        return Boolean(
          await Promise.all([
            TermModel.exists({
              organizationId: organization,
              academicYearId: value,
            }),
            TeacherAssignmentModel.exists({
              organizationId: organization,
              academicYearId: value,
            }),
          ]).then((references) => references.some(Boolean)),
        );
      case 'class':
        return Boolean(
          await Promise.all([
            AcademicSectionModel.exists({
              organizationId: organization,
              classId: value,
            }),
            TeacherAssignmentModel.exists({
              organizationId: organization,
              classId: value,
            }),
          ]).then((references) => references.some(Boolean)),
        );
      case 'section':
        return Boolean(
          await TeacherAssignmentModel.exists({
            organizationId: organization,
            sectionId: value,
          }),
        );
      case 'subject':
        return Boolean(
          await TeacherAssignmentModel.exists({
            organizationId: organization,
            subjectId: value,
          }),
        );
    }
  }
  async validateAcademicYear(
    organizationId: string,
    id: string,
  ): Promise<boolean> {
    return Boolean(
      await AcademicYearModel.exists({
        _id: oid(id),
        organizationId: oid(organizationId),
      }),
    );
  }
  async validateSubject(organizationId: string, id: string): Promise<boolean> {
    return Boolean(
      await SubjectModel.exists({
        _id: oid(id),
        organizationId: oid(organizationId),
      }),
    );
  }
  async validateStaff(organizationId: string, id: string): Promise<boolean> {
    return Boolean(
      await StaffMemberModel.exists({
        _id: oid(id),
        organizationId: oid(organizationId),
        status: 'active',
      }),
    );
  }

  private uniqueConflict(error: unknown, message: string): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new AppError(409, 'DUPLICATE_RESOURCE', message);
    }
  }

  private teacherConflict(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new AppError(
        409,
        'TEACHER_ASSIGNMENT_CONFLICT',
        'This teacher is already assigned to the selected section for this academic year.',
      );
    }
  }

  private async created<T>(
    result: Promise<T | null>,
    resource: string,
  ): Promise<T> {
    const record = await result;
    if (!record) {
      throw new AppError(
        500,
        'ACADEMICS_WRITE_FAILED',
        `${resource} was saved but could not be loaded.`,
      );
    }
    return record;
  }
}
