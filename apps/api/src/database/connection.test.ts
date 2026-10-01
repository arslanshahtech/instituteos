import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: { readyState: 0 },
  connect: vi.fn(),
  disconnect: vi.fn(),
  modelInit: [vi.fn(), vi.fn(), vi.fn()],
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
}));

import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseReady,
} from './connection.js';

describe('database connection readiness', () => {
  beforeEach(() => {
    mocks.connection.readyState = 0;
    mocks.connect.mockReset().mockImplementation(async () => {
      mocks.connection.readyState = 1;
    });
    mocks.disconnect.mockReset().mockImplementation(async () => {
      mocks.connection.readyState = 0;
    });
    for (const modelInit of mocks.modelInit) {
      modelInit.mockReset().mockResolvedValue(undefined);
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
