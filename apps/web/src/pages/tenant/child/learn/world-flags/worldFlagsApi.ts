import { API_BASE } from '../../../../../lib/api';

// FHS-373 — World Flags data-source adapter.
// One of `kidToken` or `memberId` is always supplied; never both.
// Kid mode:    hits /api/kid/world-flags*, sends only Bearer token, omits memberId from POSTs.
// Parent mode: hits /api/world-flags*,     sends Bearer + x-tenant-slug, includes memberId.

export type WorldFlagsMode =
  | { kidToken: string; memberId?: undefined; parentHeaders?: undefined }
  | { memberId: string; parentHeaders: Record<string, string>; kidToken?: undefined };

export interface WorldFlagsApi {
  /** Request headers (already includes Content-Type where needed for GETs). */
  readonly headers: Record<string, string>;
  /** GET explored flags URL. */
  exploreUrl(): string;
  /** POST explore (mark a flag as seen) URL. */
  explorePostUrl(): string;
  /** POST explore body. */
  explorePostBody(countryCode: string): Record<string, string>;
  /** GET learn progress URL. */
  learnUrl(): string;
  /** POST learn-complete URL. */
  learnCompleteUrl(): string;
  /** POST learn-complete body. */
  learnCompleteBody(continent: string, chunkIndex: number): Record<string, unknown>;
  /**
   * Stable key to use wherever a per-user identifier is needed client-side
   * (e.g. localStorage best-score key). In kid mode we use the kidToken as
   * the opaque per-kid identifier; in parent mode we use memberId.
   */
  readonly userKey: string;
}

export function worldFlagsApi(mode: WorldFlagsMode): WorldFlagsApi {
  if (mode.kidToken) {
    const tok = mode.kidToken;
    const h = { Authorization: `Bearer ${tok}` };
    return {
      headers: h,
      userKey: tok,
      exploreUrl: () => `${API_BASE}/api/kid/world-flags`,
      explorePostUrl: () => `${API_BASE}/api/kid/world-flags/explore`,
      explorePostBody: (countryCode) => ({ countryCode }),
      learnUrl: () => `${API_BASE}/api/kid/world-flags/learn`,
      learnCompleteUrl: () => `${API_BASE}/api/kid/world-flags/learn-complete`,
      learnCompleteBody: (continent, chunkIndex) => ({ continent, chunkIndex }),
    };
  }

  // Union guarantees both are present when kidToken is absent.
  const mid = mode.memberId as string;
  const ph = mode.parentHeaders as Record<string, string>;
  return {
    headers: ph,
    userKey: mid,
    exploreUrl: () => `${API_BASE}/api/world-flags?memberId=${mid}`,
    explorePostUrl: () => `${API_BASE}/api/world-flags/explore`,
    explorePostBody: (countryCode) => ({ memberId: mid, countryCode }),
    learnUrl: () => `${API_BASE}/api/world-flags/learn?memberId=${mid}`,
    learnCompleteUrl: () => `${API_BASE}/api/world-flags/learn-complete`,
    learnCompleteBody: (continent, chunkIndex) => ({ memberId: mid, continent, chunkIndex }),
  };
}
