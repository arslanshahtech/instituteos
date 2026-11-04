import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: { readyState: 0, name: 'test' },
  connect: vi.fn(),
  disconnect: vi.fn(),
  modelInit: [
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
  ],
}));

vi.mock('mongoose', () => ({
  default: {
    connection: mocks.connection,
    connect: mocks.connect,
    disconnect: mocks.disconnect,
  },
}));

vi.mock('../modules/tenancy/tenancy.model.js', () => ({
  OrganizationModel: { init: mocks.modelInit[0] },
  MembershipModel: { init: mocks.modelInit[1] },
  PlatformRoleGrantModel: { init: mocks.modelInit[2] },
  CampusModel: { init: mocks.modelInit[3] },
  OrganizationInvitationModel: { init: mocks.modelInit[4] },
  OrganizationAuditEventModel: { init: mocks.modelInit[5] },
}));

vi.mock('../modules/attendance/attendance.model.js', () => ({
  StudentAttendanceModel: { init: mocks.modelInit[6] },
  StaffAttendanceModel: { init: mocks.modelInit[7] },
  StudentSectionPlacementModel: { init: mocks.modelInit[8] },
}));

vi.mock('../modules/academics/academics.model.js', () => ({
  AcademicYearModel: { init: mocks.modelInit[9] },
  TermModel: { init: mocks.modelInit[10] },
  AcademicClassModel: { init: mocks.modelInit[11] },
  AcademicSectionModel: { init: mocks.modelInit[12] },
  SubjectModel: { init: mocks.modelInit[13] },
  TeacherAssignmentModel: { init: mocks.modelInit[14] },
  TeacherTimetableModel: { init: mocks.modelInit[15] },
}));

import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseReady,
} from './connection.js';

describe('database connection readiness', () => {
  beforeEach(() => {
    mocks.connection.readyState = 0;
    mocks.connect.mockReset().mockImplementation(async (_uri, options) => {
      mocks.connection.readyState = 1;
      mocks.connection.name = options?.dbName ?? 'test';
    });
    mocks.disconnect.mockReset().mockImplementation(async () => {
      mocks.connection.readyState = 0;
    });
    for (const modelInit of mocks.modelInit) {
      modelInit.mockReset().mockResolvedValue(undefined);
    }
  });

  it('pins local development connections to instituteos_dev', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      await connectDatabase('mongodb://test.invalid/another_db', 1000);
      expect(mocks.connect).toHaveBeenCalledWith(
        'mongodb://test.invalid/another_db',
        { serverSelectionTimeoutMS: 1000, dbName: 'instituteos_dev' },
      );
      expect(isDatabaseReady()).toBe(true);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('rejects a development connection if the selected database is not instituteos_dev', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    mocks.connect.mockImplementationOnce(async () => {
      mocks.connection.readyState = 1;
      mocks.connection.name = 'wrong_database';
    });
    try {
      await expect(
        connectDatabase('mongodb://test.invalid/wrong_database', 1000),
      ).rejects.toThrow('expected instituteos_dev');
      expect(mocks.disconnect).toHaveBeenCalledOnce();
      expect(isDatabaseReady()).toBe(false);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('remains unready until every required tenancy model initializes', async () => {
    let finishMembershipInitialization: (() => void) | undefined;
    mocks.modelInit[1].mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishMembershipInitialization = resolve;
        }),
    );

    const connection = connectDatabase('mongodb://test.invalid/test', 1000);
    await vi.waitFor(() =>
      expect(
        mocks.modelInit.every((modelInit) => modelInit.mock.calls.length),
      ).toBe(true),
    );

    expect(isDatabaseReady()).toBe(false);
    finishMembershipInitialization?.();
    await connection;

    expect(isDatabaseReady()).toBe(true);
  });

  it('disconnects and remains unready when required model initialization fails', async () => {
    mocks.modelInit[2].mockRejectedValue(
      new Error('index initialization failed'),
    );

    await expect(
      connectDatabase('mongodb://test.invalid/test', 1000),
    ).rejects.toThrow('index initialization failed');

    expect(mocks.disconnect).toHaveBeenCalledOnce();
    expect(isDatabaseReady()).toBe(false);
  });

  it('clears model readiness when the database disconnects', async () => {
    await connectDatabase('mongodb://test.invalid/test', 1000);
    await disconnectDatabase();

    expect(isDatabaseReady()).toBe(false);
  });
});
