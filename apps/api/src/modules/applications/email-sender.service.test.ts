/**
 * Unit tests for EmailSenderService.
 *
 * Tests cover:
 * - Test 7: send() calls nodemailer createTransport with decrypted SMTP password
 */

// Mock nodemailer
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn().mockReturnValue({
  sendMail: mockSendMail,
});
jest.mock('nodemailer', () => ({
  createTransport: mockCreateTransport,
}));

// Mock token-cipher
const mockDecryptToken = jest.fn().mockReturnValue('decrypted-password-123');
jest.mock('../../common/crypto/token-cipher.js', () => ({
  decryptToken: mockDecryptToken,
}));

// Mock logger
jest.mock('@job-agent/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import { EmailSenderService } from './email-sender.service.js';

describe('EmailSenderService', () => {
  let service: EmailSenderService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailSenderService();
  });

  it('Test 7: send() calls nodemailer createTransport with decrypted SMTP password', async () => {
    mockSendMail.mockResolvedValueOnce({ messageId: 'test-message-id-123' });

    const smtpConfig = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: 'user@gmail.com',
      password: 'encrypted:iv:ciphertext',
      fromName: 'John Doe',
      fromEmail: 'john@gmail.com',
    };

    const result = await service.send({
      to: 'hr@company.com',
      subject: 'Application for Senior Developer',
      body: 'Dear Hiring Team, I am applying...',
      smtpConfig,
    });

    // Verify decryptToken was called with the encrypted password
    expect(mockDecryptToken).toHaveBeenCalledWith('encrypted:iv:ciphertext');

    // Verify createTransport was called with decrypted password
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: expect.objectContaining({
          user: 'user@gmail.com',
          pass: 'decrypted-password-123',
        }),
      })
    );

    // Verify sendMail was called with correct params
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hr@company.com',
        subject: 'Application for Senior Developer',
        text: 'Dear Hiring Team, I am applying...',
      })
    );

    // Verify message ID is returned
    expect(result).toBe('test-message-id-123');
  });

  it('throws when SMTP send fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP authentication failed'));

    const smtpConfig = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: 'user@gmail.com',
      password: 'encrypted:iv:ciphertext',
      fromName: 'John Doe',
      fromEmail: 'john@gmail.com',
    };

    await expect(
      service.send({
        to: 'hr@company.com',
        subject: 'Test',
        body: 'Test body',
        smtpConfig,
      })
    ).rejects.toThrow('SMTP authentication failed');
  });
});
