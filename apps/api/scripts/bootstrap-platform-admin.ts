import {
  connectDatabase,
  disconnectDatabase,
} from '../src/database/connection.js';
import { env } from '../src/config/env.js';
import { AuthUserModel } from '../src/modules/auth/auth.model.js';
import { PlatformRoleGrantModel } from '../src/modules/tenancy/tenancy.model.js';

const emailIndex = process.argv.indexOf('--email');
const email =
  emailIndex >= 0 ? process.argv[emailIndex + 1]?.trim().toLowerCase() : '';
const confirmed = process.argv.includes('--confirm-bootstrap');

function printUsage() {
  console.error(
    'Usage: npm run bootstrap:platform-admin -- --email <existing-active-account-email> --confirm-bootstrap',
  );
}

async function main() {
  if (!email || !email.includes('@') || !confirmed) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  await connectDatabase(env.databaseUri, env.databaseServerSelectionTimeoutMs);
  try {
    const user = await AuthUserModel.findOne({ email })
      .select('_id email displayName status emailVerifiedAt')
      .lean();

    if (!user) {
      throw new Error(
        'No account exists for that email. Register the account and sign in normally before granting platform access.',
      );
    }
    if (user.status !== 'active') {
      throw new Error(
        'The account is not active. Resolve account verification/status first; this command will not activate or create accounts.',
      );
    }
    if (env.nodeEnv === 'production' && !user.emailVerifiedAt) {
      throw new Error(
        'Production bootstrap requires a verified email address.',
      );
    }

    const priorGrant = await PlatformRoleGrantModel.findOne({
      userId: user._id,
      role: 'platform_super_admin',
    });

    if (priorGrant?.status === 'active') {
      console.log(
        'This account already has an active platform_super_admin grant. No changes made.',
      );
      return;
    }

    const activeGrantCount = await PlatformRoleGrantModel.countDocuments({
      role: 'platform_super_admin',
      status: 'active',
    });
    if (activeGrantCount > 0) {
      throw new Error(
        'An active platform administrator already exists. Initial bootstrap is disabled; use the authenticated administrator-management process instead.',
      );
    }

    if (priorGrant) {
      priorGrant.status = 'active';
      // A one-time bootstrap has no prior platform administrator to record as granter.
      priorGrant.grantedByUserId = user._id;
      await priorGrant.save();
    } else {
      // Record the bootstrap subject as granter only for the first administrator,
      // when the database contains no active platform-administrator grant.
      await PlatformRoleGrantModel.create({
        userId: user._id,
        role: 'platform_super_admin',
        status: 'active',
        grantedByUserId: user._id,
      });
    }

    console.log(
      `Granted platform_super_admin to ${user.displayName} (${user.email}). Sign in with that existing account, then open /platform or /super-admin.`,
    );
    console.log(
      'This command does not create a password, change organization membership, or bypass the login flow.',
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Platform-admin bootstrap failed.',
  );
  process.exitCode = 1;
});
