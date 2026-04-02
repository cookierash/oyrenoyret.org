# Authentication Module

A comprehensive, secure authentication system for the EdTech + NGO platform, designed specifically for students under 18 with parental verification and consent requirements.

## Architecture

The authentication module is organized in a modular structure:

```
src/modules/auth/
├── actions/          # Server actions for registration and login
├── components/       # React components (wizard, forms)
├── schemas/          # Zod validation schemas
├── services/         # External services (email)
├── steps/           # Individual registration step components
└── utils/           # Utility functions (password, session, CSRF, verification)
```

## Features

### Multi-Step Registration Flow

1. **Step 1: Student Information**
   - Name, surname, email, password, grade
   - Strong password validation
   - Email uniqueness check

2. **Step 2: Parent/Guardian Information**
   - Parent name and email
   - Email must differ from student email

3. **Step 3: Parent Email Verification**
   - 6-digit numeric code sent to parent email
   - Time-limited (15 minutes)
   - Single-use code
   - Rate-limited resend functionality

4. **Step 4: Parental Consent**
   - Consent form display
   - Required checkbox confirmation
   - Consent versioning

5. **Step 5: Registration Complete**
   - Account activation
   - Confirmation screen
   - Redirect to login

### Login System

- Email + password authentication
- Secure session management with httpOnly cookies
- Rate limiting (5 attempts per 15 minutes)
- Validation checks:
  - Registration completion
  - Parent email verification
  - Consent granted

## Security Features

### Password Security
- bcrypt hashing (12 rounds)
- Strong password requirements:
  - Minimum 8 characters
  - Uppercase letter
  - Lowercase letter
  - Number
  - Special character

### Session Management
- httpOnly cookies (not accessible via JavaScript)
- Secure flag in production
- SameSite: lax
- 30-day expiration
- Database-backed sessions

### Rate Limiting
- Login: 5 attempts per 15 minutes
- Verification resend: 3 attempts per 15 minutes
- Registration: 10 attempts per hour

### CSRF Protection
- Token generation and validation
- httpOnly cookie storage
- Constant-time comparison

### Data Validation
- Client-side: React Hook Form + Zod
- Server-side: Zod schemas
- Type-safe throughout

## Database Schema

### User Model
- UUID primary key
- Email (unique, indexed)
- Password hash (nullable for OAuth)
- Registration step tracking
- Parent email and information
- Status: INACTIVE → ACTIVE

### GuardianVerification Model
- 6-digit code storage
- Expiration tracking
- Attempt counter
- Single-use flag

### ParentalConsent Model
- Consent status tracking
- Version tracking
- Timestamps (granted, revoked, expires)

### AuthSession Model
- Session token (unique)
- User association
- Expiration tracking
- IP address and user agent

## Usage

### Registration

```tsx
import { RegistrationWizard } from '@/src/modules/auth';

export default function RegisterPage() {
  return <RegistrationWizard />;
}
```

### Login

```tsx
import { LoginForm } from '@/src/modules/auth';

export default function LoginPage() {
  return <LoginForm />;
}
```

### Server Actions

```tsx
import { login, registerStudentInfo } from '@/src/modules/auth';

// Login
const result = await login({ email, password });

// Registration Step 1
const result = await registerStudentInfo({
  firstName,
  lastName,
  email,
  password,
  confirmPassword,
  grade,
});
```

### Session Management

```tsx
import { getCurrentSession, deleteSession } from '@/src/modules/auth';

// Get current user
const userId = await getCurrentSession();

// Logout
await deleteSession();
```

## Environment Variables

Required environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Environment (development/production)
- `ADMIN_EMAIL` (optional): Admin login email for bootstrap
- `ADMIN_PASSWORD_HASH` (optional): bcrypt hash for admin password

## Email Service

The email service (`services/email.ts`) currently logs verification codes to the console in development. In production, integrate with a proper email service provider:

- SendGrid
- AWS SES
- Resend
- Nodemailer with SMTP

Update `sendVerificationCode()` function to use your email provider.

## Future Extensibility

### OAuth Integration
- User model already supports nullable passwordHash
- Add OAuth providers (Google, Microsoft, etc.)
- Create OAuth-specific login flows

### Multi-Factor Authentication
- Add MFA model to schema
- Extend login flow with MFA step
- Support TOTP apps

### Password Reset
- Add password reset tokens model
- Create reset flow with email verification
- Rate limit reset requests

### Consent Management
- Allow consent revocation
- Consent expiration handling
- Consent version updates

## Testing Considerations

1. **Unit Tests**: Test validation schemas, password utilities
2. **Integration Tests**: Test server actions with database
3. **E2E Tests**: Test complete registration and login flows
4. **Security Tests**: Test rate limiting, CSRF protection, session security

## Notes

- All authentication logic is server-side only
- No sensitive data exposed to client
- OWASP Top 10 compliant
- GDPR/COPPA considerations for minors
- Accessible forms with ARIA labels
- Responsive design
