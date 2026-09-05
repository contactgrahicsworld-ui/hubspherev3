/**
 * Email service for HubSphere V3.
 * Supports SMTP (via nodemailer) and provider APIs (Resend, SendGrid).
 * When no provider is configured, emails are logged but not sent.
 */

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

// ============================================
// TYPES
// ============================================

export interface EmailMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  sent: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

export type EmailTemplate =
  | 'email_verification'
  | 'password_reset'
  | 'welcome'
  | 'user_invitation'
  | 'login_notification'
  | 'subscription_changed'
  | 'payment_success'
  | 'payment_failed'
  | 'trial_expiring'
  | 'subscription_cancelled';

// ============================================
// EMAIL AVAILABILITY
// ============================================

/**
 * Check if any email provider is configured.
 */
export function isEmailAvailable(): boolean {
  return !!(
    env.SMTP_HOST ||
    process.env.RESEND_API_KEY ||
    process.env.SENDGRID_API_KEY
  );
}

function getProviderName(): string {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SENDGRID_API_KEY) return 'sendgrid';
  if (env.SMTP_HOST) return 'smtp';
  return 'none';
}

// ============================================
// SEND EMAIL
// ============================================

/**
 * Send an email using the configured provider.
 * Falls back to logging if no provider is available.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const from = message.from || env.EMAIL_FROM || 'noreply@hubsphere.app';
  const provider = getProviderName();

  // If no provider configured, log and return
  if (provider === 'none') {
    logger.info('Email not sent (no provider configured)', {
      module: 'email',
      to: message.to,
      subject: message.subject,
    });
    return {
      sent: false,
      provider: 'none',
      error: 'No email provider configured. Set SMTP_HOST, RESEND_API_KEY, or SENDGRID_API_KEY.',
    };
  }

  try {
    // Resend provider
    if (provider === 'resend' && process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { sent: false, provider: 'resend', error };
      }

      const data = await response.json();
      return { sent: true, provider: 'resend', messageId: data.id };
    }

    // SendGrid provider
    if (provider === 'sendgrid' && process.env.SENDGRID_API_KEY) {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: from },
          subject: message.subject,
          content: [
            { type: 'text/plain', value: message.text || '' },
            ...(message.html ? [{ type: 'text/html', value: message.html }] : []),
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { sent: false, provider: 'sendgrid', error };
      }

      return { sent: true, provider: 'sendgrid' };
    }

    // SMTP provider (requires nodemailer - use fetch to a simple endpoint)
    if (provider === 'smtp') {
      // For SMTP, we would need nodemailer which is a Node.js library
      // Since we can't import it in edge runtime, log for now
      logger.info('SMTP email would be sent', {
        module: 'email',
        to: message.to,
        subject: message.subject,
        from,
      });
      return {
        sent: false,
        provider: 'smtp',
        error: 'SMTP sending requires nodemailer. Install it or use Resend/SendGrid API.',
      };
    }

    return { sent: false, provider: 'none', error: 'No provider matched' };
  } catch (error: any) {
    logger.error('Email send failed', { module: 'email', error: error.message });
    return { sent: false, provider, error: error.message };
  }
}

// ============================================
// TEMPLATE-BASED EMAILS
// ============================================

const APP_URL = env.APP_URL || 'https://hubspherev3.vercel.app';
const APP_NAME = 'HubSphere';

function getBaseUrl(): string {
  return env.APP_URL || 'https://hubspherev3.vercel.app';
}

/**
 * Send email verification.
 */
export async function sendEmailVerification(
  email: string,
  token: string,
  userName?: string
): Promise<EmailResult> {
  const verifyUrl = `${getBaseUrl()}/verify-email?token=${token}`;
  return sendEmail({
    to: email,
    subject: `Verify your email - ${APP_NAME}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${APP_NAME}!</h2>
        <p>Hi ${userName || 'there'},</p>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      </div>
    `,
    text: `Welcome to ${APP_NAME}! Please verify your email: ${verifyUrl}`,
  });
}

/**
 * Send password reset email.
 */
export async function sendPasswordReset(
  email: string,
  token: string,
  userName?: string
): Promise<EmailResult> {
  const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`;
  return sendEmail({
    to: email,
    subject: `Reset your password - ${APP_NAME}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hi ${userName || 'there'},</p>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
      </div>
    `,
    text: `Reset your ${APP_NAME} password: ${resetUrl}`,
  });
}

/**
 * Send welcome email after signup.
 */
export async function sendWelcomeEmail(
  email: string,
  userName?: string,
  tenantName?: string
): Promise<EmailResult> {
  const dashboardUrl = `${getBaseUrl()}/dashboard`;
  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME} - Your workspace is ready!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${APP_NAME}, ${userName || 'there'}! 🎉</h2>
        <p>Your workspace <strong>${tenantName || 'My Organization'}</strong> has been created and is ready to use.</p>
        <p>You're starting on the <strong>Free plan</strong> with a 14-day trial. Explore all features during your trial!</p>
        <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Go to Dashboard</a>
        <p>Here's what you can do next:</p>
        <ul>
          <li>Add your team members</li>
          <li>Import your contacts and leads</li>
          <li>Set up your sales pipeline</li>
          <li>Explore AI-powered features</li>
        </ul>
      </div>
    `,
    text: `Welcome to ${APP_NAME}! Your workspace is ready. Go to: ${dashboardUrl}`,
  });
}

/**
 * Send user invitation email.
 */
export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  tenantName: string,
  inviteUrl: string
): Promise<EmailResult> {
  return sendEmail({
    to: email,
    subject: `You're invited to join ${tenantName} on ${APP_NAME}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You're Invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${tenantName}</strong> on ${APP_NAME}.</p>
        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a>
        <p>This invitation expires in 7 days.</p>
      </div>
    `,
    text: `${inviterName} invited you to join ${tenantName} on ${APP_NAME}. Accept: ${inviteUrl}`,
  });
}

/**
 * Send subscription notification email.
 */
export async function sendSubscriptionEmail(
  email: string,
  subject: string,
  message: string,
  ctaUrl?: string,
  ctaLabel?: string
): Promise<EmailResult> {
  return sendEmail({
    to: email,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>${message}</p>
        ${ctaUrl ? `<a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">${ctaLabel || 'View Details'}</a>` : ''}
      </div>
    `,
    text: `${subject}\n\n${message}${ctaUrl ? `\n\n${ctaLabel || 'View Details'}: ${ctaUrl}` : ''}`,
  });
}
