/**
 * Email Service
 * 
 * Handles sending verification codes and other auth-related emails.
 * 
 * NOTE: In production, integrate with a proper email service provider
 * (e.g., SendGrid, AWS SES, Resend, etc.)
 */

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

  if (!resendApiKey || !fromAddress) {
    if (isDev) {
      console.log(`[EMAIL SERVICE] Missing RESEND_API_KEY/EMAIL_FROM; skipping send.`);
      console.log(`[EMAIL SERVICE] Verification code for ${email}: ${code}`);
      return;
    }
    throw new Error('Email service not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }

  if (isDev) {
    console.log(`[EMAIL SERVICE] Sending verification code to ${email}`);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: email,
      subject: 'Your oyrenoyret.org verification code',
      html: generateVerificationEmailHtml(code),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    if (isDev) {
      console.error(`[EMAIL SERVICE] Failed to send email: ${errorText}`);
    }
    throw new Error('Failed to send verification email');
  }
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
