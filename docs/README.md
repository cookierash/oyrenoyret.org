# Documentation

This directory contains project documentation.

## Architecture

The platform follows a modular, domain-driven design with clear separation of concerns:

- **app/**: Next.js App Router - routing layer only (minimal logic)
- **src/core/**: Platform engine (interaction models, records, credits)
- **src/modules/**: Domain modules (users, sessions, consent, reports)
- **src/services/**: External integrations (db, email, auth)
- **src/db/**: Prisma client + repositories
- **src/lib/**: Shared utilities (validation, permissions, security)
- **src/config/**: Centralized rules/constants
- **src/types/**: Global TypeScript types
- **src/security/**: Security utilities

## Security

All security configurations are implemented with a defense-in-depth approach. See `src/security/` for utilities.

## Database

Prisma is used for database access. Run migrations with:

```bash
npx prisma migrate dev
```

Generate Prisma client:

```bash
npx prisma generate
```
