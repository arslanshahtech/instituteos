import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import type { AuthEmailDelivery } from './auth.types.js';

const transport =
  env.smtpHost && env.smtpUser && env.smtpPassword && env.smtpFrom
    ? nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        requireTLS: !env.smtpSecure,
        auth: { user: env.smtpUser, pass: env.smtpPassword },
      })
    : null;

function logDeliveryFailure(purpose: string, error?: unknown): void {
  const details =
    typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>)
      : {};
  console.warn(
    JSON.stringify({
      level: 'warn',
      event: 'auth.email.delivery.failed',
      purpose,
      ...(!transport || !env.smtpFrom ? { reason: 'smtp_not_configured' } : {}),
      ...(typeof details.code === 'string' ? { code: details.code } : {}),
      ...(typeof details.responseCode === 'number'
        ? { responseCode: details.responseCode }
        : {}),
      ...(typeof details.command === 'string'
        ? { command: details.command }
        : {}),
    }),
  );
}

export class SmtpAuthEmailDelivery implements AuthEmailDelivery {
  async sendVerification(email: string, token: string): Promise<boolean> {
    if (!transport || !env.smtpFrom) {
      logDeliveryFailure('verification');
      return false;
    }
    const url = `${env.authWebAppUrl.replace(/\/$/, '')}/verify-email#token=${encodeURIComponent(token)}`;
    try {
      await transport.sendMail({
        from: env.smtpFrom,
        to: email,
        subject: 'Verify your InstituteOS account',
        text: `Verify your account using this link: ${url}`,
      });
      return true;
    } catch (error) {
      logDeliveryFailure('verification', error);
      return false;
    }
  }

  async sendPasswordReset(email: string, token: string): Promise<boolean> {
    if (!transport || !env.smtpFrom) {
      logDeliveryFailure('password_reset');
      return false;
    }
    const url = `${env.authWebAppUrl.replace(/\/$/, '')}/reset-password#token=${encodeURIComponent(token)}`;
    try {
      await transport.sendMail({
        from: env.smtpFrom,
        to: email,
        subject: 'Reset your InstituteOS password',
        text: `Reset your password using this link: ${url}`,
      });
      return true;
    } catch (error) {
      logDeliveryFailure('password_reset', error);
      return false;
    }
  }

  async sendInvitation(
    email: string,
    token: string,
    organizationName: string,
  ): Promise<boolean> {
    if (!transport || !env.smtpFrom) {
      logDeliveryFailure('invitation');
      return false;
    }
    const url = `${env.authWebAppUrl.replace(/\/$/, '')}/invitations/accept#token=${encodeURIComponent(token)}`;
    try {
      await transport.sendMail({
        from: env.smtpFrom,
        to: email,
        subject: `Invitation to join ${organizationName} on InstituteOS`,
        text: `You have been invited to join ${organizationName}. Sign in or create an account, then accept this invitation: ${url}`,
      });
      return true;
    } catch (error) {
      logDeliveryFailure('invitation', error);
      return false;
    }
  }
}

export const authEmailDelivery = new SmtpAuthEmailDelivery();
