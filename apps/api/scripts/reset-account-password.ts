import { createInterface } from 'node:readline/promises';
import {
  connectDatabase,
  disconnectDatabase,
} from '../src/database/connection.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/modules/auth/password.js';
import {
  AuthSessionModel,
  AuthUserModel,
} from '../src/modules/auth/auth.model.js';
import { MembershipModel } from '../src/modules/tenancy/tenancy.model.js';

const email = process.argv[2]?.trim().toLowerCase();

function readHidden(prompt: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error(
      'Run this command in an interactive terminal so the password can be hidden.',
    );
  }

  process.stdout.write(prompt);
  input.setEncoding('utf8');
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener('data', onData);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003')
          return finish(new Error('Password reset cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };
    input.on('data', onData);
  });
}

async function main() {
  if (!email || !email.includes('@')) {
    throw new Error('Usage: npm run reset-account-password -- <account-email>');
  }

  await connectDatabase(env.databaseUri, env.databaseServerSelectionTimeoutMs);
  try {
    const user = await AuthUserModel.findOne({ email })
      .select('_id status')
      .lean();
    if (!user || user.status !== 'active') {
      throw new Error(
        'No active account was found for that email. No changes made.',
      );
    }

    const isConfiguredPlatformAdmin = email === env.platformAdminEmail;
    const isActiveOrganizationOwner = Boolean(
      await MembershipModel.exists({
        userId: user._id,
        role: 'organization_owner',
        status: 'active',
      }),
    );

    if (!isConfiguredPlatformAdmin && !isActiveOrganizationOwner) {
      throw new Error(
        'Only the configured Platform Admin or an active Organization Owner can use this local reset.',
      );
    }

    const confirmationTerminal = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    let confirmation: string;
    try {
      confirmation = (
        await confirmationTerminal.question(
          'Type RESET to continue (visible): ',
        )
      ).trim();
    } finally {
      confirmationTerminal.close();
    }
    if (confirmation !== 'RESET') {
      throw new Error('Confirmation did not match. No changes made.');
    }

    const password = await readHidden('New password (hidden): ');
    if (password.length < 12 || password.length > 128) {
      throw new Error(
        'Password must be 12 to 128 characters. No changes made.',
      );
    }
    const confirmationPassword = await readHidden(
      'Confirm new password (hidden): ',
    );
    if (password !== confirmationPassword) {
      throw new Error('Passwords do not match. No changes made.');
    }

    await AuthUserModel.updateOne(
      { _id: user._id, status: 'active' },
      {
        $set: { passwordHash: await hashPassword(password) },
        $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
      },
    );
    await AuthSessionModel.deleteMany({ userId: user._id });
    console.log(
      'Password reset successful. The password was not displayed or stored in plain text.',
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Password reset failed.',
  );
  process.exitCode = 1;
});
