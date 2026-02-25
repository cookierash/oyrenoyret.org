# Oyrenoyret.org - NGO EdTech Platform

A production-grade, security-first EdTech platform designed for minors, built with Next.js, TypeScript, and PostgreSQL.

## 🏗️ Architecture

This platform follows a **modular, domain-driven design** with clear separation of concerns:

- **app/**: Next.js App Router - routing layer only (minimal logic)
- **src/core/**: Platform engine (interaction models, records, credits)
- **src/modules/**: Domain modules (users, sessions, consent, reports)
- **src/services/**: External integrations (db, email, auth)
- **src/db/**: Prisma client + repositories
- **src/lib/**: Shared utilities (validation, permissions, security)
- **src/config/**: Centralized rules/constants
- **src/types/**: Global TypeScript types
- **src/security/**: Security utilities

## 🛠️ Tech Stack

- **Next.js 16** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS** (professional blue design system)
- **PostgreSQL** (via Prisma ORM)
- **shadcn/ui** (component library)

## 🔒 Security Features

- Secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
- CSRF protection utilities
- Rate limiting utilities
- Input validation with Zod
- Secure token generation
- Server-only database access
- Parental consent tracking

## 📦 Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your database URL and secrets.

4. Set up the database:
   ```bash
   npm run db:migrate
   ```

5. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

6. Run the development server:
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
/
├── app/                    # Next.js App Router routes
│   ├── (auth)/            # Authentication routes
│   ├── dashboard/         # User dashboard
│   ├── parent/            # Parent portal
│   ├── admin/             # Admin portal
│   └── api/               # API routes
│
├── src/
│   ├── core/              # Platform engine
│   ├── modules/           # Domain modules
│   │   ├── users/
│   │   ├── sessions/
│   │   ├── consent/
│   │   └── reports/
│   ├── services/          # External integrations
│   ├── db/                # Prisma client
│   ├── lib/               # Shared utilities
│   ├── config/            # Configuration
│   ├── types/             # Global types
│   └── security/          # Security utilities
│
├── prisma/
│   └── schema.prisma      # Database schema
│
└── components/
    └── ui/                # shadcn/ui components
```

## 🗄️ Database

The platform uses Prisma ORM with PostgreSQL. Key models:

- **User**: User accounts with roles (STUDENT, PARENT, ADMIN, TEACHER)
- **ParentalConsent**: Consent tracking for minors
- **Session**: Learning session tracking
- **AcademicRecord**: Academic progress records

### Database Commands

- Generate Prisma client: `npm run db:generate`
- Create migration: `npm run db:migrate`
- Open Prisma Studio: `npm run db:studio`
- Push schema changes: `npm run db:push`

## 🎨 Design System

The platform uses a professional blue color palette:
- **Primary**: Blue shades (50-950)
- **Neutral**: Balanced white & black tones
- **Design tone**: Academic, trustworthy, calm, NGO-appropriate

## 🔐 Security Best Practices

1. **Never expose secrets to the client**
2. **Validate all inputs server-side**
3. **Use environment variables for sensitive data**
4. **Implement rate limiting on all API routes**
5. **Use CSRF protection for state-changing operations**
6. **Store parental consent with version tracking**
7. **Never store sensitive documents directly**

## 📝 Development Guidelines

- **TypeScript strict mode**: All code must pass strict type checking
- **Modular design**: Modules should be isolated and removable
- **Security first**: All features must consider security implications
- **Clean code**: Small, focused files with clear naming
- **Comments explain WHY**: Code should be self-documenting

## 🚀 Deployment

1. Set production environment variables
2. Run database migrations
3. Build the application: `npm run build`
4. Start the server: `npm start`

## 📄 License

[Add your license here]

## 🤝 Contributing

[Add contribution guidelines here]

---

**Note**: This is a foundational scaffold. Business logic and features will be implemented incrementally.
