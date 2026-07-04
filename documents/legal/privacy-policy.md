# Family Hub — Privacy Policy (DRAFT)

> **Status: DRAFT for founder review.** Fill every `«placeholder»` and have a
> solicitor review before publishing. Family Hub is a service used by children,
> so the UK **Age Appropriate Design Code (Children's Code)** and UK GDPR apply.
> This draft is a starting point, not legal advice.

**Last updated:** «date»
**Applies to:** the Family Hub web app and website («domain»).

---

## 1. Who we are

Family Hub ("we", "us") is operated by **«legal entity name»**, «registered
address», company number «number». We are the "data controller" for the
personal data described here.

Questions or requests about your data: **«privacy@yourdomain»** (or write to us
at the address above). «If you appoint a Data Protection Officer, name them and
give their contact here.»

## 2. Who this is for

Family Hub is a tool for **parents/guardians to run their family** — meals,
activities, tasks, habits and a kids' rewards ("sticker") system. **Adults
create the account.** Children use the app through a profile that a parent sets
up and controls (a name, an avatar, and a PIN). Family Hub is **not** aimed at
children signing up on their own.

## 3. What we collect

**From the parent/account owner**

- Account: email address, display name, the family's name.
- Settings: timezone, currency, app name/subtitle.
- Billing (only if you subscribe): handled by **Stripe** — we do not store your
  card number. «Confirm Stripe.»

**About children in the family (entered/controlled by the parent)**

- Profile: display name (often a first name only), chosen avatar emoji, and a
  short numeric **PIN** (stored hashed, never in plain text).
- Activity in the app: habits ticked, tasks, meals, calendar activities,
  learning progress (Maths/Logic/World Flags), and the in-app rewards
  ("stickers"/savings/investments) — all of which are used only to run the
  features you use.

We deliberately keep children's data **minimal**. We do **not** ask children
for contact details, we do **not** collect precise location, and we do **not**
collect special-category data (health, ethnicity, etc.).

**Collected automatically**

- Basic technical data needed to run and secure the service (e.g. session
  cookies, IP address for security/rate-limiting, and error/diagnostic logs via
  **Sentry**). «Confirm Sentry + any analytics.» We do **not** use advertising
  trackers and we do **not** show ads.

## 4. How we use your data and our legal basis

- **To provide the service you signed up for** — legal basis: _performance of a
  contract_.
- **To keep it secure and working** (rate-limiting, error monitoring, backups)
  — legal basis: _legitimate interests_.
- **Optional feedback** you send us (the beta feedback form) — legal basis:
  _consent_; you choose whether to leave your name/email.
- **Billing**, if you subscribe — _contract_ / _legal obligation_.

We do **not** sell your data or your children's data, and we do not use it to
build advertising profiles.

## 5. Children's data — how we protect it

- A child's profile is **created and controlled by a parent**. Parents can view,
  edit, and delete their children's data at any time from the app.
- Children's data is used **only** to run the features (rewards, habits,
  learning, calendar) — never for marketing.
- We follow a **data-minimisation** approach and design with the Children's Code
  in mind (privacy-by-default, no nudge techniques, no behavioural ads).
- «If you later add any feature that changes what children's data is used for,
  update this section and seek consent.»

## 6. Who we share it with (processors)

We share data only with service providers who help us run Family Hub, under
contract, and only as needed:

- **Supabase** — authentication + database hosting. «Confirm region.»
- **Railway** — application hosting.
- **Stripe** — payments (if you subscribe).
- **«Resend / email provider»** — sending account emails (magic-link sign-in).
- **Sentry** — error monitoring.

«Confirm each processor, its location, and that a Data Processing Agreement is in
place.» We do not share your data with anyone else except where required by law.

## 7. Where your data is stored / international transfers

Your data is stored with the providers above. «State the hosting region(s) and,
if any provider processes data outside the UK/EEA, the safeguard used (e.g. UK
IDTA / EU Standard Contractual Clauses).»

## 8. How long we keep it

We keep your data for as long as your account is active. If you delete your
account, we delete or anonymise your family's data within «e.g. 30 days», except
where we must keep limited records for legal reasons (e.g. billing records for
«X years»). «Confirm retention periods.»

## 9. Your rights (UK GDPR)

You can, at any time:

- **Access** the data we hold about your family.
- **Correct** anything that's wrong (most of this you can edit directly in the
  app).
- **Delete** your account and your family's data ("right to erasure").
- **Export** your data ("data portability").
- **Restrict or object** to certain processing, and **withdraw consent** for
  anything based on consent.

You can do the main ones **in the app** (Settings → Privacy: _Export my data_ /
_Delete my account_), or email **«privacy@yourdomain»**. We'll respond within one
month. You also have the right to complain to the UK **Information
Commissioner's Office (ICO)** at ico.org.uk.

## 10. Security

We protect your data with encryption in transit (HTTPS), database **row-level
security** so one family can never see another family's data, hashed PINs, and
access controls. No system is perfectly secure, but we take reasonable steps to
protect your information.

## 11. Cookies

We use only the cookies needed to keep you signed in and to keep the service
secure. We do not use advertising or cross-site tracking cookies. «Add a cookie
list/banner if analytics are added.»

## 12. Changes to this policy

If we make significant changes we'll update this page and, where appropriate,
tell you in the app or by email.

## 13. Contact

**«legal entity name»**, «address» — **«privacy@yourdomain»**.

---

### Founder checklist before publishing

- [ ] Fill every `«placeholder»`.
- [ ] Confirm the processor list + regions + DPAs (Supabase, Railway, Stripe,
      email, Sentry, any analytics).
- [ ] Set retention periods.
- [ ] Decide on a DPO (needed if you process children's data at scale).
- [ ] **Have a solicitor review** — especially the children's-data + Children's
      Code sections.
- [ ] Add a matching **Terms of Service**.
