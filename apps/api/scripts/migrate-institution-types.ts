import mongoose from 'mongoose';
import {
  connectDatabase,
  disconnectDatabase,
} from '../src/database/connection.js';
import { env } from '../src/config/env.js';
import { OrganizationModel } from '../src/modules/tenancy/tenancy.model.js';

const args = process.argv.slice(2);
const organizationId = args[args.indexOf('--organization-id') + 1];
const institutionType = args[args.indexOf('--type') + 1];
const apply = args.includes('--apply');

async function main() {
  await connectDatabase(env.databaseUri, env.databaseServerSelectionTimeoutMs);
  try {
    if (!organizationId) {
      const missing = await OrganizationModel.find({
        $or: [
          { institutionType: { $exists: false } },
          { institutionType: null },
        ],
      })
        .select('_id name')
        .sort({ name: 1 })
        .lean();
      console.log(`Organizations requiring a type: ${missing.length}`);
      for (const item of missing) console.log(`${item._id}\t${item.name}`);
      console.log(
        'Read-only audit. Assign a type explicitly with --organization-id <id> --type school|college --apply.',
      );
      return;
    }
    if (
      !mongoose.isValidObjectId(organizationId) ||
      !['school', 'college'].includes(institutionType ?? '')
    ) {
      throw new Error(
        'Usage: npm run migrate:institution-types -- --organization-id <id> --type school|college [--apply]',
      );
    }
    const organization = await OrganizationModel.findById(organizationId)
      .select('_id name institutionType')
      .lean();
    if (!organization) throw new Error('Organization not found.');
    if (
      organization.institutionType &&
      organization.institutionType !== institutionType
    ) {
      throw new Error(
        `Organization already has type "${organization.institutionType}". No change made.`,
      );
    }
    if (organization.institutionType === institutionType) {
      console.log(
        `No change needed: ${organization.name} is already ${institutionType}.`,
      );
      return;
    }
    if (!apply) {
      console.log(
        `DRY RUN: would set ${organization.name} (${organization._id}) to ${institutionType}. Add --apply to write this one explicit change.`,
      );
      return;
    }
    const result = await OrganizationModel.updateOne(
      {
        _id: organization._id,
        $or: [
          { institutionType: { $exists: false } },
          { institutionType: null },
        ],
      },
      { $set: { institutionType } },
    );
    if (result.modifiedCount !== 1)
      throw new Error(
        'Organization changed concurrently. Refresh the audit and retry.',
      );
    console.log(
      `Updated ${organization.name} to ${institutionType}. No student, fee, attendance, exam, or academic records were modified.`,
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'Institution type migration failed.',
  );
  process.exitCode = 1;
});
