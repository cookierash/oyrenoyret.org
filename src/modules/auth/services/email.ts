/**
 * Email Service
 * 
 * Handles sending verification codes and other auth-related emails.
 *
 * Production configuration:
 * - `RESEND_API_KEY`
 * - `EMAIL_FROM` (e.g. "OyrenOyret <no-reply@oyrenoyret.org>")
 */

type ResendEmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

async function sendResendEmail(payload: ResendEmailPayload): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const isDev = process.env.NODE_ENV === 'development';
  const logOnly = isDev && process.env.EMAIL_DEV_LOG_ONLY === '1';

  if (logOnly) {
    console.log(`[EMAIL DEV] Skipping send (EMAIL_DEV_LOG_ONLY=1).`);
    console.log(`[EMAIL DEV] To: ${payload.to}`);
    console.log(`[EMAIL DEV] Subject: ${payload.subject}`);
    return;
  }

  if (!resendApiKey) {
    throw new Error('Email service not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }

  const attempts = 2;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        if (isDev) {
          try {
            const asJson = (await response.json().catch(() => null)) as { id?: string } | null;
            if (asJson?.id) {
              console.log(`[EMAIL SERVICE] Resend accepted message id: ${asJson.id}`);
            }
          } catch {
            // ignore
          }
        }
        return;
      }

      let errorText = 'Unknown error';
      try {
        const asJson = (await response.json().catch(() => null)) as
          | { message?: string; name?: string; error?: string }
          | null;
        if (asJson?.message) errorText = asJson.message;
        else if (asJson?.error) errorText = asJson.error;
        else if (asJson?.name) errorText = asJson.name;
        else {
          errorText = await response.text().catch(() => 'Unknown error');
        }
      } catch {
        errorText = await response.text().catch(() => 'Unknown error');
      }

      // Retry transient provider errors.
      const isRetryable = response.status >= 500;
      if (attempt < attempts && isRetryable) {
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }

      throw new Error(`Resend error (${response.status}): ${errorText}`);
    } catch (error) {
      // Retry network errors.
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      throw error;
    }
  }
}

/**
 * Sends a verification code to a parent email
 * @param email Parent email address
 * @param code 6-digit verification code
 * @returns Promise that resolves when email is sent
 */
export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;
  const isDev = process.env.NODE_ENV === 'development';
  const logOnly = isDev && process.env.EMAIL_DEV_LOG_ONLY === '1';

  if (!resendApiKey || !fromAddress) {
    if (logOnly) {
      console.log(`[EMAIL SERVICE] Missing RESEND_API_KEY/EMAIL_FROM; skipping send.`);
      console.log(`[EMAIL SERVICE] Verification code for ${email}: ${code}`);
      return;
    }
    throw new Error('Email service not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }

  if (isDev) {
    console.log(`[EMAIL SERVICE] Sending verification code to ${email}`);
  }

  await sendResendEmail({
    from: fromAddress,
    to: email,
    subject: 'Your oyrenoyret.org verification code',
    html: generateVerificationEmailHtml(code),
  });
}

/**
 * Sends a password reset link
 * @param email User email address
 * @param resetUrl Absolute reset URL containing the token
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;
  const isDev = process.env.NODE_ENV === 'development';
  const logOnly = isDev && process.env.EMAIL_DEV_LOG_ONLY === '1';

  if (!resendApiKey || !fromAddress) {
    if (logOnly) {
      console.log(`[EMAIL SERVICE] Missing RESEND_API_KEY/EMAIL_FROM; skipping send.`);
      console.log(`[EMAIL SERVICE] Password reset link for ${email}: ${resetUrl}`);
      return;
    }
    throw new Error('Email service not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }

  if (isDev) {
    console.log(`[EMAIL SERVICE] Sending password reset email to ${email}`);
  }

  await sendResendEmail({
    from: fromAddress,
    to: email,
    subject: 'Reset your oyrenoyret.org password',
    html: generatePasswordResetEmailHtml(resetUrl),
  });
}

/**
 * Sends a password change notification email
 * @param email User email address
 */
export async function sendPasswordChangedEmail(email: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;
  const isDev = process.env.NODE_ENV === 'development';
  const logOnly = isDev && process.env.EMAIL_DEV_LOG_ONLY === '1';

  if (!resendApiKey || !fromAddress) {
    if (logOnly) {
      console.log(`[EMAIL SERVICE] Missing RESEND_API_KEY/EMAIL_FROM; skipping send.`);
      console.log(`[EMAIL SERVICE] Password changed notification for ${email}`);
      return;
    }
    throw new Error('Email service not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }

  if (isDev) {
    console.log(`[EMAIL SERVICE] Sending password changed email to ${email}`);
  }

  await sendResendEmail({
    from: fromAddress,
    to: email,
    subject: 'Your oyrenoyret.org password was changed',
    html: generatePasswordChangedEmailHtml(),
  });
}

/**
 * Sends an account email verification link
 * @param email User email address
 * @param verifyUrl Absolute verification URL containing the token
 */
export async function sendAccountVerificationEmail(email: string, verifyUrl: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM;
  const isDev = process.env.NODE_ENV === 'development';
  const logOnly = isDev && process.env.EMAIL_DEV_LOG_ONLY === '1';

  if (!resendApiKey || !fromAddress) {
    if (logOnly) {
      console.log(`[EMAIL SERVICE] Missing RESEND_API_KEY/EMAIL_FROM; skipping send.`);
      console.log(`[EMAIL SERVICE] Email verification link for ${email}: ${verifyUrl}`);
      return;
    }
    throw new Error('Email service not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }

  if (isDev) {
    console.log(`[EMAIL SERVICE] Sending account verification email to ${email}`);
  }

  await sendResendEmail({
    from: fromAddress,
    to: email,
    subject: 'Verify your oyrenoyret.org email',
    html: generateAccountVerificationEmailHtml(verifyUrl),
  });
}

/**
 * Generates HTML content for verification email
 * @param code Verification code
 * @returns HTML string
 */
export function generateVerificationEmailHtml(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Email Verification</h1>
          <p>Thank you for registering your child on oyrenoyret.org.</p>
          <p>Please use the following verification code to complete the registration:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h2 style="color: #1d4ed8; font-size: 32px; letter-spacing: 4px; margin: 0;">${code}</h2>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">oyrenoyret.org - Educational Platform</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates HTML content for password reset email
 * @param resetUrl Absolute reset URL
 * @returns HTML string
 */
export function generatePasswordResetEmailHtml(resetUrl: string): string {
  const safeUrl = resetUrl.replace(/"/g, '&quot;');
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Reset your password</h1>
          <p>We received a request to reset your oyrenoyret.org password.</p>
          <p>Click the button below to set a new password. This link will expire in 1 hour.</p>
          <div style="margin: 20px 0;">
            <a
              href="${safeUrl}"
              style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 16px; border-radius: 8px; text-decoration: none; font-weight: 500;"
            >
              Reset password
            </a>
          </div>
          <p style="word-break: break-all;">
            If the button doesn't work, copy and paste this link into your browser:<br />
            <a href="${safeUrl}">${safeUrl}</a>
          </p>
          <p>If you did not request this, you can ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">oyrenoyret.org - Educational Platform</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates HTML content for password change notification
 * @returns HTML string
 */
export function generatePasswordChangedEmailHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Password changed</h1>
          <p>Your oyrenoyret.org password was just changed.</p>
          <p>If you did not make this change, please reset your password immediately and contact support.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">oyrenoyret.org - Educational Platform</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates HTML content for account verification email
 * @param verifyUrl Absolute verification URL
 * @returns HTML string
 */
export function generateAccountVerificationEmailHtml(verifyUrl: string): string {
  const safeUrl = verifyUrl.replace(/"/g, '&quot;');
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Verify your email</h1>
          <p>To participate on oyrenoyret.org (join events, create materials, post, vote), please verify your email.</p>
          <div style="margin: 20px 0;">
            <a
              href="${safeUrl}"
              style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 16px; border-radius: 8px; text-decoration: none; font-weight: 500;"
            >
              Verify email
            </a>
          </div>
          <p style="word-break: break-all;">
            If the button doesn't work, copy and paste this link into your browser:<br />
            <a href="${safeUrl}">${safeUrl}</a>
          </p>
          <p>This link will expire in 24 hours.</p>
          <p>If you did not request this, you can ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">oyrenoyret.org - Educational Platform</p>
        </div>
      </body>
    </html>
  `;
}
