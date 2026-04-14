import { execSync } from 'node:child_process';

const run = (command, options = {}) => {
  execSync(command, { stdio: 'inherit', ...options });
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const isProduction =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const requireMigrations = process.env.REQUIRE_DB_MIGRATIONS === '1' || isProduction;
  const skipMigrations = process.env.SKIP_DB_MIGRATIONS === '1';

  if (!skipMigrations) {
    const migrationDatabaseUrl =
      process.env.MIGRATION_DATABASE_URL ??
      process.env.DIRECT_DATABASE_URL ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.POSTGRES_URL ??
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL;

    const env = migrationDatabaseUrl
      ? { ...process.env, DATABASE_URL: migrationDatabaseUrl }
      : process.env;

    const isTooManyConnectionsError = (err) => {
      const message = err instanceof Error ? err.message : String(err ?? '');
      return /too many connections/i.test(message);
    };

    const maxAttempts = Number(
      process.env.PRISMA_MIGRATE_DEPLOY_RETRIES ?? (isProduction ? 6 : 2)
    );
    const baseDelayMs = Number(process.env.PRISMA_MIGRATE_DEPLOY_DELAY_MS ?? 2000);
    let migrated = false;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        run('npx prisma migrate deploy', { env });
        migrated = true;
        break;
      } catch (error) {
        lastError = error;
        if (!isTooManyConnectionsError(error) || attempt === maxAttempts) break;
        const waitMs = baseDelayMs * attempt;
        console.warn(
          `[vercel-build] prisma migrate deploy failed (too many connections). Retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})...`
        );
        // eslint-disable-next-line no-await-in-loop
        await delay(waitMs);
      }
    }

    if (!migrated) {
      const ignoreInProdWhenTooManyConnections =
        isProduction &&
        isTooManyConnectionsError(lastError) &&
        process.env.FAIL_ON_MIGRATION_CONNECTIONS !== '1';

      if (requireMigrations && !ignoreInProdWhenTooManyConnections) {
        throw lastError;
      }

      console.warn(
        '[vercel-build] prisma migrate deploy failed; continuing build. ' +
          (ignoreInProdWhenTooManyConnections
            ? 'Reason: database connection limit reached during deploy. Run migrations out-of-band once capacity is available.'
            : 'Reason: migrations are not required for this environment.')
      );
    }
  } else {
    console.warn('[vercel-build] SKIP_DB_MIGRATIONS=1; skipping prisma migrate deploy.');
  }

  run('npx prisma generate');
  run('npx next build --webpack');
}

main().catch((error) => {
  console.error('[vercel-build] Fatal error:', error);
  process.exit(1);
});
