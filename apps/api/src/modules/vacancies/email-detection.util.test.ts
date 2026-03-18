/**
 * Tests for email detection utility.
 * Covers extraction from apply_options (mailto:) and job description regex,
 * filtering of non-application emails, and edge cases.
 */
import { detectRecipientEmail } from './email-detection.util.js';

describe('detectRecipientEmail', () => {
  // Test 1: extract from apply_options mailto: link
  it('extracts email from apply_options with mailto: link', () => {
    const result = detectRecipientEmail(
      [{ publisher: 'Company HR', apply_link: 'mailto:hr@company.com', is_direct: true }],
      'No email in description.'
    );
    expect(result).toEqual({ email: 'hr@company.com', method: 'apply_options' });
  });

  // Test 2: extract from job description text via regex
  it('extracts email from job description text via regex', () => {
    const result = detectRecipientEmail(
      undefined,
      'Send your CV to recruiter@acme.co — we look forward to hearing from you.'
    );
    expect(result).toEqual({ email: 'recruiter@acme.co', method: 'jd_regex' });
  });

  // Test 3: multiple emails in JD returns first match
  it('returns the first application-worthy email when multiple exist in JD', () => {
    const result = detectRecipientEmail(
      undefined,
      'Contact hiring@startup.io or backup@startup.io for more info.'
    );
    expect(result.email).toBe('hiring@startup.io');
    expect(result.method).toBe('jd_regex');
  });

  // Test 4: no email found returns manual_required
  it('returns { email: null, method: manual_required } when no email is found', () => {
    const result = detectRecipientEmail(
      [],
      'Apply via our online portal. No email address provided here.'
    );
    expect(result).toEqual({ email: null, method: 'manual_required' });
  });

  // Test 5: ignores noreply/info/support prefixes
  it('ignores common non-application emails and returns manual_required', () => {
    const result = detectRecipientEmail(
      undefined,
      'Questions? Email noreply@company.com or info@company.com or support@company.com'
    );
    expect(result).toEqual({ email: null, method: 'manual_required' });
  });

  // Test 6: apply_options with https:// link falls through to JD regex
  it('falls through to JD regex when apply_options has non-mailto links', () => {
    const result = detectRecipientEmail(
      [{ publisher: 'LinkedIn', apply_link: 'https://www.linkedin.com/jobs/apply/123', is_direct: false }],
      'Send resume to jobs@techcorp.com for consideration.'
    );
    expect(result).toEqual({ email: 'jobs@techcorp.com', method: 'jd_regex' });
  });

  // Test 7: handles various valid email formats
  it('handles user.name@sub.domain.co.uk format', () => {
    const result = detectRecipientEmail(
      undefined,
      'Apply to john.smith@careers.acme.co.uk with your CV.'
    );
    expect(result).toEqual({ email: 'john.smith@careers.acme.co.uk', method: 'jd_regex' });
  });

  it('handles user+tag@domain.com format', () => {
    const result = detectRecipientEmail(
      undefined,
      'Please send applications to hiring+engineer@startup.io'
    );
    expect(result).toEqual({ email: 'hiring+engineer@startup.io', method: 'jd_regex' });
  });

  // Extra: apply_options with ignored mailto prefix is skipped, falls to JD
  it('skips noreply mailto: in apply_options and falls through to JD regex', () => {
    const result = detectRecipientEmail(
      [{ apply_link: 'mailto:noreply@company.com' }],
      'Contact us at careers@company.com'
    );
    expect(result).toEqual({ email: 'careers@company.com', method: 'jd_regex' });
  });

  // Extra: empty apply_options array falls through to JD
  it('handles empty apply_options array by falling through to JD regex', () => {
    const result = detectRecipientEmail(
      [],
      'Send your CV to recruit@example.com'
    );
    expect(result).toEqual({ email: 'recruit@example.com', method: 'jd_regex' });
  });

  // Extra: admin@ prefix is ignored
  it('ignores admin@ prefix emails', () => {
    const result = detectRecipientEmail(
      undefined,
      'Email admin@company.com for inquiries.'
    );
    expect(result).toEqual({ email: null, method: 'manual_required' });
  });
});
