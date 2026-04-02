# Launch Guide

This guide covers local development launch and production deployment for Oyrenoyret.org.

## 1. Prerequisites

- Node.js 18+
- PostgreSQL
- npm or yarn
- A Vercel account (if deploying on Vercel)

## 2. Local Launch (Development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Fill in at least: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

3. Run database migrations:
   ```bash
   npm run db:migrate
   ```

4. Generate the Prisma client:
   ```bash
   npm run db:generate
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open the app:
   ```
   http://localhost:3000
   ```

Optional local tools:

- Prisma Studio:
  ```bash
  npm run db:studio
  ```

## 3. Required Environment Variables

- `DATABASE_URL` - PostgreSQL connection string.
- `NEXTAUTH_SECRET` - Minimum 32 characters.
- `NEXTAUTH_URL` - App base URL (recommended in production).
- `CRON_SECRET` - Required in production if you enable cron endpoints.

Optional variables:

- `DISCUSSION_INACTIVITY_HOURS` - Override archive window for discussions.
- `SESSION_CACHE_TTL_MS` - Session cache TTL in milliseconds.
- `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` - Path to mocked Google Fonts responses.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` - Optional admin bootstrap credentials.

## 4. Production Launch on Vercel

1. Create a Vercel Postgres database and copy `POSTGRES_URL`.

2. In Vercel project settings, add environment variables:
   - `DATABASE_URL` = your `POSTGRES_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (your production domain)
   - `CRON_SECRET` (required if using cron endpoints)

3. Run migrations with Vercel CLI:
   ```bash
   npm i -g vercel
   vercel login
   vercel link
   vercel env pull .env.local
   npx prisma migrate deploy
   ```

4. Deploy by pushing to your main branch or using the Vercel dashboard.

5. Verify deployment:
   - Check Vercel deployment logs for database errors.
   - Visit your production URL.

## 5. Production Launch (Self-Hosted)

1. Provision PostgreSQL and set `DATABASE_URL`.

2. Set production environment variables:
   - `NODE_ENV=production`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `CRON_SECRET` (if using cron endpoints)

3. Install dependencies, generate client, and migrate:
   ```bash
   npm install
   npm run db:generate
   npx prisma migrate deploy
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   ```

## 6. Cron Endpoint Setup

The platform exposes:

- `GET /api/cron/archive-discussions`

In production, set `CRON_SECRET` and call the endpoint with:

```
Authorization: Bearer <CRON_SECRET>
```

## 7. Pre-Launch Checklist

1. Confirm environment variables are set in production.
2. Run `npx prisma migrate deploy` against the production database.
3. Verify the app starts and connects to the database.
4. Confirm cron endpoint protection with `CRON_SECRET` if used.
5. Configure an email provider for verification emails.
6. Run tests:
   ```bash
   npm test
   ```

## 8. Troubleshooting

- "Can't reach database server": verify `DATABASE_URL` and network access.
- "Migration failed": check database permissions and run migrations locally first.
- "Prisma client not found": ensure `npm run db:generate` runs before build.

## 9. Notes on Email

The auth email service currently logs verification codes in development. For production, replace it with a real email provider in `src/modules/auth/services/email.ts`.
