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

export class SmtpAuthEmailDelivery implements AuthEmailDelivery {
  async sendVerification(email: string, token: string): Promise<boolean> {
    if (!transport || !env.smtpFrom) return false;
    const url = `${env.authWebAppUrl.replace(/\/$/, '')}/verify-email#token=${encodeURIComponent(token)}`;
    try {
      await transport.sendMail({
        from: env.smtpFrom,
        to: email,
        subject: 'Verify your InstituteOS account',
        text: `Verify your account using this link: ${url}`,
      });
      return true;
    } catch {
      return false;
    }
  }

  async sendPasswordReset(email: string, token: string): Promise<boolean> {
    if (!transport || !env.smtpFrom) return false;
    const url = `${env.authWebAppUrl.replace(/\/$/, '')}/reset-password#token=${encodeURIComponent(token)}`;
    try {
      await transport.sendMail({
        from: env.smtpFrom,
        to: email,
        subject: 'Reset your InstituteOS password',
        text: `Reset your password using this link: ${url}`,
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const authEmailDelivery = new SmtpAuthEmailDelivery();
