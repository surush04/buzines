const { PrismaClient: SqliteClient } = require('../generated/sqlite-client');
const { PrismaClient: PostgresClient } = require('@prisma/client');

const sourceUrl = process.env.SOURCE_SQLITE_URL;
const targetUrl = process.env.DATABASE_URL;
const dryRun = process.argv.includes('--dry-run');

if (!sourceUrl || !sourceUrl.startsWith('file:')) {
  throw new Error('Set SOURCE_SQLITE_URL to the existing SQLite database file URL.');
}
if (!dryRun && (!targetUrl || !/^postgres(?:ql)?:\/\//.test(targetUrl))) {
  throw new Error('Set DATABASE_URL to the Render PostgreSQL external connection URL.');
}

const source = new SqliteClient({ datasources: { db: { url: sourceUrl } } });
let target;

async function populatedTables() {
  const tables = await source.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_prisma%'",
  );
  const populated = [];
  for (const { name } of tables) {
    const quotedName = `"${name.replaceAll('"', '""')}"`;
    const [{ count }] = await source.$queryRawUnsafe(
      `SELECT COUNT(*) AS count FROM ${quotedName}`,
    );
    if (Number(count) > 0) populated.push({ name, count: Number(count) });
  }
  return populated;
}

async function migrate() {
  const populated = await populatedTables();
  const supported = new Set([
    'users',
    'companies',
    'company_settings',
    'ai_settings',
    'job_runs',
    'refresh_tokens',
  ]);
  const unsupported = populated.filter(({ name }) => !supported.has(name));
  if (unsupported.length) {
    throw new Error(
      `SQLite contains data in tables this migration does not yet support: ${unsupported
        .map(({ name }) => name)
        .join(', ')}`,
    );
  }

  const [users, companies, companySettings, aiSettings, jobRuns] = await Promise.all([
    source.user.findMany(),
    source.company.findMany(),
    source.companySettings.findMany(),
    source.aiSettings.findMany(),
    source.jobRun.findMany(),
  ]);

  if (dryRun) {
    console.log(
      `Source is ready: ${users.length} users, ${companies.length} companies, ` +
        `${companySettings.length} company settings, ${aiSettings.length} AI settings, ` +
        `${jobRuns.length} job runs.`,
    );
    console.log('Refresh tokens will not be copied.');
    return;
  }

  target = new PostgresClient({ datasources: { db: { url: targetUrl } } });
  await target.$transaction(async (tx) => {
    if ((await tx.user.count()) !== 0 || (await tx.company.count()) !== 0) {
      throw new Error('Target PostgreSQL database is not empty; refusing to merge data.');
    }

    if (users.length) await tx.user.createMany({ data: users });
    if (companies.length) await tx.company.createMany({ data: companies });
    if (companySettings.length) await tx.companySettings.createMany({ data: companySettings });
    if (aiSettings.length) await tx.aiSettings.createMany({ data: aiSettings });
    if (jobRuns.length) await tx.jobRun.createMany({ data: jobRuns });
  });

  console.log(
    `Migrated ${users.length} users, ${companies.length} companies, ` +
      `${companySettings.length} company settings, ${aiSettings.length} AI settings, ` +
      `${jobRuns.length} job runs.`,
  );
  console.log('Refresh tokens were not copied; users will need to sign in again.');
}

migrate()
  .catch((error) => {
    console.error('SQLite-to-PostgreSQL migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([source.$disconnect(), target?.$disconnect()]);
  });
