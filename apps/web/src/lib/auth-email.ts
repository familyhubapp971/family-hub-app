// FHS-604: the address a sign-in link was requested for.
//
// sessionStorage lives and dies with one tab, and an email link always opens
// a NEW tab, so the expired-link screen came up empty exactly when it mattered.
// localStorage survives across tabs and restarts, so the new tab can say
// "We will send it to sarah@khan.family" instead of asking who you are.
//
// Deliberate trade-off: the address persists on the device. It is the same
// address the sign-in screens already display, not a secret, and it is
// overwritten by the next request rather than accumulating.

const KEY = 'fh.auth.email';

/** Remember the address a magic link was just requested for. */
export function rememberAuthEmail(email: string): void {
  try {
    localStorage.setItem(KEY, email);
  } catch {
    /* private mode or storage denied: the same-tab flow still works */
  }
}

/** The last address a magic link was requested for on this device. */
export function recallAuthEmail(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}
