/**
 * EmailSenderService — sends application emails via SMTP using nodemailer.
 *
 * Decrypts the user's SMTP password at send time using AES-256-GCM token-cipher.
 * Creates a fresh transporter per send to avoid stale connection state.
 */

import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { createLogger } from '@job-agent/logger';
import { decryptToken } from '../../common/crypto/token-cipher.js';
import type { SmtpConfigType } from '@job-agent/core';

const logger = createLogger('EmailSenderService');

/** Parameters required to dispatch an application email */
export interface SendEmailParams {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** Plain-text email body */
  body: string;
  /** User's SMTP configuration (password is AES-256-GCM encrypted at rest) */
  smtpConfig: SmtpConfigType;
}

@Injectable()
export class EmailSenderService {
  /**
   * Sends an email using the user's SMTP configuration.
   * Decrypts the SMTP password at send time using token-cipher.
   *
   * @param params - Recipient, subject, body, and SMTP config
   * @returns SMTP message ID on success
   * @throws Error on SMTP authentication or delivery failure
   */
  async send(params: SendEmailParams): Promise<string> {
    const { to, subject, body, smtpConfig } = params;

    const decryptedPassword = decryptToken(smtpConfig.password);

    const transporter: Transporter = createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: decryptedPassword,
      },
    });

    const info = await transporter.sendMail({
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
      to,
      subject,
      text: body,
    });

    const messageId = typeof info.messageId === 'string' ? info.messageId : String(info.messageId);
    logger.info('Email sent successfully', { to, subject, messageId });
    return messageId;
  }
}
