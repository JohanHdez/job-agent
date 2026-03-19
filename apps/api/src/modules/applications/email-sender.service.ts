/**
 * EmailSenderService — sends application emails via Gmail API.
 *
 * Uses the user's Google OAuth access token (stored encrypted) so no SMTP
 * credentials are required. The token is decrypted at send time.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { google } from 'googleapis';
import { createLogger } from '@job-agent/logger';
import { decryptToken } from '../../common/crypto/token-cipher.js';

const logger = createLogger('EmailSenderService');

/** Parameters required to dispatch an application email */
export interface SendEmailParams {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** Plain-text email body */
  body: string;
  /** Sender display name (user's full name) */
  fromName: string;
  /** Sender email address (user's Google account email) */
  fromEmail: string;
  /** AES-256-GCM encrypted Google OAuth access token */
  encryptedGoogleToken: string;
}

@Injectable()
export class EmailSenderService {
  /**
   * Sends an email using the Gmail API with the user's Google OAuth token.
   * Decrypts the token at send time — never stored in plain text.
   *
   * @param params - Recipient, subject, body, sender info, encrypted token
   * @returns Gmail message ID on success
   * @throws BadRequestException when Google token is missing or expired
   */
  async send(params: SendEmailParams): Promise<string> {
    const { to, subject, body, fromName, fromEmail, encryptedGoogleToken } = params;

    const accessToken = decryptToken(encryptedGoogleToken);

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth });

    // RFC 2822 message format
    const rawMessage = [
      `From: "${fromName}" <${fromEmail}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    const encoded = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encoded },
      });

      const messageId = res.data.id ?? 'unknown';
      logger.info('Email sent via Gmail API', { to, subject, messageId });
      return messageId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Gmail API send failed', { to, error: msg });
      throw new BadRequestException(`Failed to send email via Gmail API: ${msg}`);
    }
  }
}
