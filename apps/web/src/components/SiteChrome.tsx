import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@familyhub/ui';

// SiteChrome — shared header + footer for the public marketing/legal
// pages (FHS-509), so the new /legal/* section never feels like a
// different website. Forensic port of the Magic Patterns design
// (7f19f840-c796-4eaa-90fc-934fb4ef587d, components/SiteChrome.tsx),
// adapted in three deliberate ways:
//  1. Uses the repo's own Button (@familyhub/ui) instead of MP's local
//     mock, and the `kingdom` design token instead of a literal hex.
//  2. Drops MP's `localStorage.getItem('fh_loggedIn')` logged-in check
//     — that key is never set anywhere in this codebase (it's an MP
//     demo artefact), so porting it verbatim would ship a dead code
//     path. The real marketing pages that aren't the homepage
//     (About/Pricing) don't show a logged-in state either, so this
//     matches that established, working pattern instead.
//  3. Adds "About" to the header nav (MP's version doesn't have it,
//     predating FHS-436) so the Legal section doesn't regress
//     cross-page navigation the rest of the site already has.
// The footer's tagline + copyright/reward-disclaimer line is kept
// verbatim from MP — it's legal-adjacent copy, not styling.

export type SiteChromeSection = 'features' | 'about' | 'pricing' | 'legal';

const NAV_LINKS: {
  to: string;
  label: string;
  section: SiteChromeSection;
  mobile: boolean;
}[] = [
  { to: '/', label: 'Features', section: 'features', mobile: false },
  { to: '/about', label: 'About', section: 'about', mobile: false },
  { to: '/pricing', label: 'Pricing', section: 'pricing', mobile: true },
  { to: '/legal', label: 'Legal', section: 'legal', mobile: true },
];

export function SiteHeader({ current }: { current?: SiteChromeSection } = {}) {
  const navigate = useNavigate();

  return (
    <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-1 px-3 py-4 xs:px-4 md:gap-2 md:px-6">
      <Link
        to="/"
        className="shrink-0 font-heading text-xl text-white transition-opacity hover:opacity-90 md:text-2xl"
      >
        FamilyHub
      </Link>

      {/* Mobile nav: Features + About stay desktop-only (same call
          WelcomePage already made — FHS-277 — so the row doesn't wrap
          at 375px); Pricing and Legal always show. */}
      <nav className="flex items-center gap-1 font-bold md:gap-8">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`px-1 py-2.5 transition-colors hover:text-yellow-300 xs:px-1.5 md:px-2 ${
              link.mobile ? '' : 'hidden md:inline'
            } ${current === link.section ? 'text-yellow-300' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-1 md:gap-4">
        <Link
          to="/login"
          className="px-1 py-2.5 font-bold transition-colors hover:text-yellow-300 xs:px-1.5 md:px-2"
        >
          Log in
        </Link>
        <Button onClick={() => navigate('/signup')} variant="primary">
          Start free
        </Button>
      </div>
    </header>
  );
}

export const LEGAL_LINKS = [
  { to: '/legal/privacy', label: 'Privacy' },
  { to: '/legal/children', label: 'Children & Parents' },
  { to: '/legal/terms', label: 'Terms' },
  { to: '/legal/cookies', label: 'Cookies' },
  { to: '/legal', label: 'All legal' },
];

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-16 border-t-2 border-black/30 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:gap-10">
        <div className="md:flex-1">
          <p className="font-heading text-xl">FamilyHub</p>
          <p className="mt-1 text-sm font-bold text-purple-300">
            One calm place for the whole family.
          </p>
        </div>

        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 md:justify-end">
          {LEGAL_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-[44px] items-center text-sm font-bold text-purple-200 transition-colors hover:text-yellow-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <p className="mx-auto w-full max-w-7xl px-6 pb-8 text-xs font-bold text-purple-400">
        © {new Date().getFullYear()} [Legal entity name]. Virtual rewards are play money with no
        cash value.
      </p>
    </footer>
  );
}
