import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

// PrivacyPage — public /privacy route (FHS-435). Renders the draft
// policy at documents/legal/privacy-policy.md as readable JSX so the
// signup consent link ("Privacy Policy") has somewhere real to point.
// The source markdown is still a DRAFT (full of «placeholder» markers
// the founder needs to fill + a solicitor needs to review), so this
// page keeps those markers visible and shows a banner making the draft
// status obvious to any visitor.
//
// Content is transcribed by hand rather than run through a markdown
// library — the page count is tiny (13 sections) and staying in plain
// JSX means we can style headings/paragraphs/lists with the same
// design-system tokens as the other marketing pages. The markdown's
// closing "Founder checklist before publishing" is deliberately NOT
// shown here — it's an internal to-do list for the founder + solicitor,
// not policy content for visitors.

type Block = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

interface Section {
  title: string;
  blocks: Block[];
}

const sections: Section[] = [
  {
    title: '1. Who we are',
    blocks: [
      {
        kind: 'p',
        text: 'Family Hub ("we", "us") is operated by **«legal entity name»**, «registered address», company number «number». We are the "data controller" for the personal data described here.',
      },
      {
        kind: 'p',
        text: 'Questions or requests about your data: **«privacy@yourdomain»** (or write to us at the address above). «If you appoint a Data Protection Officer, name them and give their contact here.»',
      },
    ],
  },
  {
    title: '2. Who this is for',
    blocks: [
      {
        kind: 'p',
        text: 'Family Hub is a tool for **parents/guardians to run their family**: meals, activities, tasks, habits and a kids\' rewards ("sticker") system. **Adults create the account.** Children use the app through a profile that a parent sets up and controls (a name, an avatar, and a PIN). Family Hub is **not** aimed at children signing up on their own.',
      },
    ],
  },
  {
    title: '3. What we collect',
    blocks: [
      { kind: 'p', text: '**From the parent/account owner**' },
      {
        kind: 'ul',
        items: [
          "Account: email address, display name, the family's name.",
          'Settings: timezone, currency, app name/subtitle.',
          'Billing (only if you subscribe): handled by **Stripe**. We do not store your card number. «Confirm Stripe.»',
        ],
      },
      { kind: 'p', text: '**About children in the family (entered/controlled by the parent)**' },
      {
        kind: 'ul',
        items: [
          'Profile: display name (often a first name only), chosen avatar emoji, and a short numeric **PIN** (stored hashed, never in plain text).',
          'Activity in the app: habits ticked, tasks, meals, calendar activities, learning progress (Maths/Logic/World Flags), and the in-app rewards ("stickers"/savings/investments), all of which are used only to run the features you use.',
        ],
      },
      {
        kind: 'p',
        text: "We deliberately keep children's data **minimal**. We do **not** ask children for contact details, we do **not** collect precise location, and we do **not** collect special-category data (health, ethnicity, etc.).",
      },
      { kind: 'p', text: '**Collected automatically**' },
      {
        kind: 'ul',
        items: [
          'Basic technical data needed to run and secure the service (e.g. session cookies, IP address for security/rate-limiting, and error/diagnostic logs via **Sentry**). «Confirm Sentry + any analytics.» We do **not** use advertising trackers and we do **not** show ads.',
        ],
      },
    ],
  },
  {
    title: '4. How we use your data and our legal basis',
    blocks: [
      {
        kind: 'ul',
        items: [
          '**To provide the service you signed up for**, legal basis: *performance of a contract*.',
          '**To keep it secure and working** (rate-limiting, error monitoring, backups), legal basis: *legitimate interests*.',
          '**Optional feedback** you send us (the beta feedback form), legal basis: *consent*; you choose whether to leave your name/email.',
          '**Billing**, if you subscribe (*contract* / *legal obligation*).',
        ],
      },
      {
        kind: 'p',
        text: "We do **not** sell your data or your children's data, and we do not use it to build advertising profiles.",
      },
    ],
  },
  {
    title: "5. Children's data: how we protect it",
    blocks: [
      {
        kind: 'ul',
        items: [
          "A child's profile is **created and controlled by a parent**. Parents can view, edit, and delete their children's data at any time from the app.",
          "Children's data is used **only** to run the features (rewards, habits, learning, calendar), never for marketing.",
          "We follow a **data-minimisation** approach and design with the Children's Code in mind (privacy-by-default, no nudge techniques, no behavioural ads).",
          "«If you later add any feature that changes what children's data is used for, update this section and seek consent.»",
        ],
      },
    ],
  },
  {
    title: '6. Who we share it with (processors)',
    blocks: [
      {
        kind: 'p',
        text: 'We share data only with service providers who help us run Family Hub, under contract, and only as needed:',
      },
      {
        kind: 'ul',
        items: [
          '**Supabase**: authentication + database hosting. «Confirm region.»',
          '**Railway**: application hosting.',
          '**Stripe**: payments (if you subscribe).',
          '**«Resend / email provider»**: sending account emails (magic-link sign-in).',
          '**Sentry**: error monitoring.',
        ],
      },
      {
        kind: 'p',
        text: '«Confirm each processor, its location, and that a Data Processing Agreement is in place.» We do not share your data with anyone else except where required by law.',
      },
    ],
  },
  {
    title: '7. Where your data is stored / international transfers',
    blocks: [
      {
        kind: 'p',
        text: 'Your data is stored with the providers above. «State the hosting region(s) and, if any provider processes data outside the UK/EEA, the safeguard used (e.g. UK IDTA / EU Standard Contractual Clauses).»',
      },
    ],
  },
  {
    title: '8. How long we keep it',
    blocks: [
      {
        kind: 'p',
        text: "We keep your data for as long as your account is active. If you delete your account, we delete or anonymise your family's data within «e.g. 30 days», except where we must keep limited records for legal reasons (e.g. billing records for «X years»). «Confirm retention periods.»",
      },
    ],
  },
  {
    title: '9. Your rights (UK GDPR)',
    blocks: [
      { kind: 'p', text: 'You can, at any time:' },
      {
        kind: 'ul',
        items: [
          '**Access** the data we hold about your family.',
          "**Correct** anything that's wrong (most of this you can edit directly in the app).",
          '**Delete** your account and your family\'s data ("right to erasure").',
          '**Export** your data ("data portability").',
          '**Restrict or object** to certain processing, and **withdraw consent** for anything based on consent.',
        ],
      },
      {
        kind: 'p',
        text: "You can do the main ones **in the app** (Settings → Privacy: *Export my data* / *Delete my account*), or email **«privacy@yourdomain»**. We'll respond within one month. You also have the right to complain to the UK **Information Commissioner's Office (ICO)** at ico.org.uk.",
      },
    ],
  },
  {
    title: '10. Security',
    blocks: [
      {
        kind: 'p',
        text: "We protect your data with encryption in transit (HTTPS), database **row-level security** so one family can never see another family's data, hashed PINs, and access controls. No system is perfectly secure, but we take reasonable steps to protect your information.",
      },
    ],
  },
  {
    title: '11. Cookies',
    blocks: [
      {
        kind: 'p',
        text: 'We use only the cookies needed to keep you signed in and to keep the service secure. We do not use advertising or cross-site tracking cookies. «Add a cookie list/banner if analytics are added.»',
      },
    ],
  },
  {
    title: '12. Changes to this policy',
    blocks: [
      {
        kind: 'p',
        text: "If we make significant changes we'll update this page and, where appropriate, tell you in the app or by email.",
      },
    ],
  },
  {
    title: '13. Contact',
    blocks: [{ kind: 'p', text: '**«legal entity name»**, «address», **«privacy@yourdomain»**.' }],
  },
];

// Splits inline text on **bold** and «placeholder» markers so both
// render distinctly — bold as emphasis, placeholders highlighted so
// the draft status stays obvious mid-paragraph, not just in the banner.
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|«[^»]+»|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, idx) => {
    if (part.startsWith('«') && part.endsWith('»')) {
      return (
        <mark
          key={idx}
          className="rounded bg-yellow-200 px-1 font-bold text-black"
          data-testid="privacy-placeholder"
        >
          {part}
        </mark>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-kingdom-bg font-body text-white">
      {/* Header — brand link + back-to-home, mirrors the other marketing pages. */}
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 md:px-6">
        <Link
          to="/"
          className="flex min-h-[44px] items-center font-heading text-xl text-white transition-opacity hover:opacity-90 md:text-2xl"
        >
          FamilyHub
        </Link>
        <Link
          to="/"
          className="flex min-h-[44px] items-center px-2 font-bold text-purple-100 transition-colors hover:text-yellow-300"
        >
          ← Back to home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 md:px-6">
        {/* Draft banner — required so nobody mistakes this for a final policy. */}
        <div
          data-testid="privacy-draft-banner"
          className="mb-6 rounded-md border-2 border-black bg-yellow-300 p-4 font-bold text-black shadow-neo-sm"
        >
          Draft privacy policy. This is our beta; the final version is coming soon.
        </div>

        <div className="rounded-xl border-2 border-black bg-white p-6 text-gray-900 shadow-neo-lg md:p-10">
          <h1 className="font-heading text-3xl md:text-4xl">Privacy Policy</h1>
          <p className="mt-2 font-bold text-gray-600">
            Last updated: {renderInline('«date»')}
            <br />
            Applies to: the Family Hub web app and website ({renderInline('«domain»')}).
          </p>

          <div className="mt-6 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="mb-2 font-heading text-xl md:text-2xl">{section.title}</h2>
                {section.blocks.map((block, idx) =>
                  block.kind === 'p' ? (
                    <p key={idx} className="mb-3 max-w-prose font-body text-base leading-relaxed">
                      {renderInline(block.text)}
                    </p>
                  ) : (
                    <ul
                      key={idx}
                      className="mb-3 ml-5 list-disc space-y-2 font-body text-base leading-relaxed"
                    >
                      {block.items.map((item, itemIdx) => (
                        <li key={itemIdx}>{renderInline(item)}</li>
                      ))}
                    </ul>
                  ),
                )}
              </section>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center px-2 font-bold text-purple-100 underline transition-colors hover:text-yellow-300"
          >
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
