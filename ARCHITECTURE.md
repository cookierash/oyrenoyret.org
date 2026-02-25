# Architecture Documentation

## Overview

This document describes the foundational architecture of the NGO EdTech platform. The architecture follows Domain-Driven Design principles with a focus on security, modularity, and maintainability.

## Directory Structure

```
/
├── app/                          # Next.js App Router (routing layer only)
│   ├── (auth)/                  # Authentication routes group
│   ├── dashboard/               # User dashboard routes
│   ├── parent/                  # Parent portal routes
│   ├── admin/                   # Admin portal routes
│   ├── api/                     # API routes
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home page
│
├── src/
│   ├── core/                    # Platform engine
│   │   └── index.ts
│   │
│   ├── modules/                 # Domain modules (isolated)
│   │   ├── users/               # User management module
│   │   │   ├── user.types.ts
│   │   │   ├── user.service.ts
│   │   │   └── user.repository.ts
│   │   ├── sessions/            # Session tracking module
│   │   ├── consent/             # Parental consent module
│   │   └── reports/             # Academic reports module
│   │
│   ├── services/                # External integrations
│   │   └── index.ts
│   │
│   ├── db/                      # Database layer
│   │   ├── client.ts            # Prisma client singleton
│   │   └── index.ts
│   │
│   ├── lib/                     # Shared utilities
│   │   ├── utils.ts             # Common utilities (cn, etc.)
│   │   ├── permissions.ts       # RBAC helpers
│   │   └── index.ts
│   │
│   ├── config/                  # Configuration
│   │   ├── constants.ts         # Application constants
│   │   ├── env.ts               # Environment validation
│   │   └── index.ts
│   │
│   ├── types/                   # Global TypeScript types
│   │   ├── common.ts
│   │   └── index.ts
│   │
│   ├── security/                # Security utilities
│   │   ├── csrf.ts              # CSRF protection
│   │   ├── rateLimiter.ts       # Rate limiting
│   │   ├── validation.ts       # Input validation
│   │   ├── tokens.ts            # Secure token generation
│   │   └── index.ts
│   │
│   └── hooks/                   # React hooks
│       └── index.ts
│
├── prisma/
│   └── schema.prisma            # Database schema
│
├── components/
│   └── ui/                      # shadcn/ui components
│
├── public/                      # Static assets
├── docs/                        # Documentation
└── scripts/                     # Utility scripts
```

## Design Principles

### 1. Modular Architecture
- Each module in `src/modules/` is self-contained
- No direct cross-module imports
- Modules can be added/removed without breaking core
- Service interfaces for inter-module communication

### 2. Separation of Concerns
- **app/**: Routing only (minimal logic)
- **src/modules/**: Domain logic (business rules)
- **src/services/**: External integrations
- **src/db/**: Data access layer
- **src/lib/**: Shared utilities

### 3. Security First
- All inputs validated server-side
- CSRF protection utilities
- Rate limiting utilities
- Secure token generation
- Server-only database access
- Security headers configured

### 4. Type Safety
- TypeScript strict mode enabled
- No `any` types
- Proper type definitions in each module
- Environment variables validated with Zod

## Database Schema

### Models

1. **User**
   - UUID primary key
   - Email (unique)
   - Role (STUDENT, PARENT, ADMIN, TEACHER)
   - Status (ACTIVE, INACTIVE, SUSPENDED)
   - Date of birth (for minors)
   - Soft delete support

2. **ParentalConsent**
   - Links to User
   - Consent status tracking
   - Version tracking
   - Timestamps (granted, revoked, expires)

3. **Session**
   - Learning session tracking
   - Status (ACTIVE, COMPLETED, ABANDONED)
   - Timestamps

4. **AcademicRecord**
   - Academic progress tracking
   - Grade, subject, score
   - Notes field

### Indexing Strategy
- Email indexes for fast lookups
- Role/status indexes for filtering
- User ID indexes for relations
- DeletedAt indexes for soft delete queries

## Security Architecture

### HTTP Headers
- Content-Security-Policy
- Strict-Transport-Security
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy
- Permissions-Policy

### Input Validation
- Zod schemas for all inputs
- Server-side validation only
- XSS prevention utilities

### Authentication & Authorization
- Role-based access control (RBAC)
- Permission utilities in `src/lib/permissions.ts`
- Secure token generation

### Data Protection
- Parental consent tracking
- Consent versioning
- No sensitive document storage
- All users assumed to be minors

## Development Guidelines

### Code Quality
- Small, focused files
- Clear naming conventions
- Comments explain WHY, not WHAT
- No feature creep
- Production-ready mindset

### TypeScript Standards
- Strict mode enabled
- No `any` types
- Proper type definitions
- File-level purpose comments

### Module Development
1. Create types in `module.types.ts`
2. Create repository in `module.repository.ts`
3. Create service in `module.service.ts`
4. Export through `index.ts`

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Database**: PostgreSQL
- **ORM**: Prisma 7
- **Validation**: Zod
- **Security**: bcryptjs, crypto

## Next Steps

This is a foundational scaffold. Future development should:

1. Implement business logic incrementally
2. Add authentication flow
3. Build parental consent workflow
4. Create dashboard interfaces
5. Add API endpoints with proper validation
6. Implement rate limiting on API routes
7. Add comprehensive error handling
8. Set up logging and monitoring

## Notes

- All security utilities are scaffolded and ready for implementation
- Database schema is minimal and extensible
- Module structure allows for easy feature addition
- No business logic implemented yet (as per requirements)
