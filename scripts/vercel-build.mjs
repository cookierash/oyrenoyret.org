import { execSync } from 'node:child_process';

const run = (command, options = {}) => {
  execSync(command, { stdio: 'inherit', ...options });
};

const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
const requireMigrations = process.env.REQUIRE_DB_MIGRATIONS === '1' || isProduction;
const skipMigrations = process.env.SKIP_DB_MIGRATIONS === '1';

if (!skipMigrations) {
  try {
    run('npx prisma migrate deploy');
  } catch (error) {
    if (requireMigrations) {
      throw error;
    }
    console.warn('[vercel-build] prisma migrate deploy failed; continuing without migrations (non-production).');
  }
} else {
  console.warn('[vercel-build] SKIP_DB_MIGRATIONS=1; skipping prisma migrate deploy.');
}

run('npx prisma generate');
run('npx next build --webpack');

