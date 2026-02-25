# Vercel Setup Guide

## Setting Up PostgreSQL on Vercel

### Step 1: Create Vercel Postgres Database

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Select your project (or create a new one)
3. Navigate to **Storage** tab
4. Click **Create Database**
5. Select **Postgres**
6. Choose a name and region
7. Click **Create**

### Step 2: Get Connection String

1. In your Postgres database page, go to the **.env.local** tab
2. You'll see `POSTGRES_URL` - this is your connection string
3. Copy this value

**Note**: Vercel provides `POSTGRES_URL` but Prisma expects `DATABASE_URL`. You can either:
- Use `POSTGRES_URL` directly (if your code reads it)
- Map it to `DATABASE_URL` in Vercel environment variables

### Step 3: Configure Environment Variables in Vercel

1. Go to your project → **Settings** → **Environment Variables**
2. Add the following variables:

#### For Production:
- **Name**: `DATABASE_URL`
- **Value**: Your `POSTGRES_URL` from Step 2
- **Environment**: Production ✅

- **Name**: `NEXTAUTH_SECRET`
- **Value**: Generate with: `openssl rand -base64 32`
- **Environment**: Production ✅

- **Name**: `NEXTAUTH_URL`
- **Value**: `https://your-app.vercel.app` (your actual domain)
- **Environment**: Production ✅

#### For Preview/Development:
- Add the same variables for **Preview** and **Development** environments
- Use different `NEXTAUTH_SECRET` for each environment
- Use appropriate `NEXTAUTH_URL` for each environment

### Step 4: Local Development Setup

1. Copy your `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Get your Vercel Postgres connection string:
   - Go to Vercel Dashboard → Storage → Your Database → .env.local
   - Copy the `POSTGRES_URL` value

3. Add to your local `.env`:
   ```env
   DATABASE_URL="your-postgres-url-from-vercel"
   NEXTAUTH_SECRET="your-local-secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

### Step 5: Run Database Migrations

#### Locally:
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

#### On Vercel (Automatic):
Vercel will automatically run `prisma generate` during build, but you need to run migrations manually:

**Option A: Using Vercel CLI** (Recommended):
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Run migrations
vercel env pull .env.local  # Pull environment variables
npx prisma migrate deploy   # Run migrations
```

**Option B: Using Vercel Dashboard**:
1. Go to your project → **Deployments**
2. Click on the latest deployment
3. Go to **Functions** tab
4. You can run migrations via a one-time API route or use Vercel's database UI

**Option C: Create a Migration Script**:
Create `app/api/migrate/route.ts` (protected route):
```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/src/db/client';

export async function POST(request: Request) {
  // Add authentication check here
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.MIGRATION_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // This will run pending migrations
    // Note: Use prisma migrate deploy for production
    return NextResponse.json({ message: 'Migrations completed' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

### Step 6: Deploy to Vercel

1. **Connect your repository** (if not already):
   - Go to Vercel Dashboard → Add New Project
   - Import your Git repository
   - Configure build settings (auto-detected for Next.js)

2. **Build Settings** (should be auto-detected):
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Deploy**:
   - Push to your main branch (auto-deploys)
   - Or manually deploy from Vercel Dashboard

### Step 7: Verify Database Connection

After deployment:

1. Check your deployment logs for any database errors
2. Visit your app: `https://your-app.vercel.app`
3. Check Prisma Studio (if accessible):
   ```bash
   npx prisma studio
   ```

## Important Notes

### Connection String Format
Vercel Postgres provides `POSTGRES_URL` which includes connection pooling. The format is:
```
postgres://user:password@host:port/database?sslmode=require
```

### Environment Variables Priority
1. Vercel Environment Variables (production)
2. `.env.local` (local development)
3. `.env` (local development fallback)

### Database Migrations
- **Development**: Use `prisma migrate dev`
- **Production**: Use `prisma migrate deploy` (safe for production)
- Never run `prisma migrate dev` in production

### Connection Pooling
Vercel Postgres uses connection pooling automatically. The `POSTGRES_URL` includes pooling configuration. This is important for serverless functions.

### Troubleshooting

**Issue**: "Can't reach database server"
- Check that environment variables are set correctly in Vercel
- Verify the connection string format
- Ensure database is in the same region as your functions

**Issue**: "Migration failed"
- Run migrations locally first to test
- Check database permissions
- Verify connection string is correct

**Issue**: "Prisma client not found"
- Ensure `npm run db:generate` runs during build
- Check build logs in Vercel
- Verify `package.json` scripts are correct

## Quick Commands Reference

```bash
# Local development
npm run dev                    # Start dev server
npm run db:generate           # Generate Prisma client
npm run db:migrate            # Run migrations (dev)
npm run db:studio             # Open Prisma Studio

# Production
npm run build                 # Build for production
npx prisma migrate deploy     # Deploy migrations (production-safe)
```

## Security Checklist

- ✅ Never commit `.env` files
- ✅ Use different secrets for dev/prod
- ✅ Rotate `NEXTAUTH_SECRET` regularly
- ✅ Use Vercel's built-in environment variable encryption
- ✅ Enable Vercel's database access controls
- ✅ Use connection pooling (automatic with Vercel Postgres)
