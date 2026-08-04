import { describe, it, expect } from 'vitest';
import { friendlyAuthErrorMessage } from '../../../../apps/web/src/lib/auth-errors';

describe('friendlyAuthErrorMessage', () => {
  it('rewrites the email rate-limit error to a helpful next-step message', () => {
    const out = friendlyAuthErrorMessage('email rate limit exceeded');
    expect(out).toMatch(/too many sign-in links/i);
    expect(out).toMatch(/google/i);
  });

  it('matches case variants Supabase returns', () => {
    expect(friendlyAuthErrorMessage('Email rate limit exceeded for project')).toMatch(
      /too many sign-in links/i,
    );
  });

  it('rewrites a generic rate-limit error without the word "email"', () => {
    expect(friendlyAuthErrorMessage('Too many requests')).toMatch(/wait a moment/i);
  });

  it('rewrites an expired-link error', () => {
    expect(friendlyAuthErrorMessage('one-time use, already been used')).toMatch(/expired/i);
  });

  it('rewrites an invalid-email error', () => {
    expect(friendlyAuthErrorMessage('invalid email format')).toMatch(/valid email/i);
  });

  it('passes through an unknown message unchanged so we never silently swallow new failures', () => {
    expect(friendlyAuthErrorMessage('Some new Supabase failure')).toBe('Some new Supabase failure');
  });

  it('falls back to a sensible default for empty / undefined input', () => {
    expect(friendlyAuthErrorMessage('')).toMatch(/something went wrong/i);
    expect(friendlyAuthErrorMessage(undefined)).toMatch(/something went wrong/i);
  });

  it("FHS-279: unknown email on login maps 'Signups not allowed' to plain copy", () => {
    expect(friendlyAuthErrorMessage('Signups not allowed for otp')).toBe(
      'No account found for this email - create an account first, then log in.',
    );
  });
});
