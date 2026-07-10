# Neeti — Centralised Policy Management Platform

Neeti is a policy publishing, targeting, attestation, and governance platform
for organizations that need to push policies to both **employees** and
**external vendor/field-agent workforces**, track who has read and
acknowledged what, and reinforce retention with a daily micro-quiz.

This build implements the full P0 scope **except Active Directory / SAML SSO
integration**, which is stubbed with a placeholder credential login (see
[Auth](#auth--the-ad--sso-swap-point) below) so the rest of the platform can
be exercised end-to-end without an external identity provider.

## Stack

- **Next.js 16** (App Router, TypeScript, Server Components + Route Handlers)
- **Prisma 5** ORM, **SQLite** for zero-infra local/dev running (see
  [Switching to Postgres](#switching-to-postgres) for production)
- **Tailwind CSS 4** for styling
- **Tiptap** for the WYSIWYG article editor
- **mammoth** for .docx → HTML conversion
- **react-pdf** (self-hosted pdf.js worker) for the built-in PDF viewer
- **cheerio** for the RBI notifications scraper
- JWT session cookies (no external auth provider) via `jsonwebtoken` + `bcryptjs`

## Getting started

```bash
npm install
npm run db:push     # creates prisma/dev.db from the schema
npm run db:seed     # seeds a demo tenant, users, vendor org, a published policy, quiz questions
npm run dev
```

`.env` is committed with local dev defaults (SQLite path + a dev-only JWT
secret, no real secrets) so there's nothing to configure before the first
run. Override it with a real `.env.local` (gitignored) for anything
machine- or deployment-specific — see `.env.example` for the variables.

`npm run dev` runs Next.js with the webpack compiler (`next dev --webpack`)
rather than the new default Turbopack, which as of Next.js 16.2.x has a
known bug that surfaces as a Turbopack "Runtime Error: Could not find the
module ... global-error.js#default ... in the React Client Manifest" —
if you hit that, it's a Turbopack issue, not an app bug.

### Troubleshooting

- **`PrismaClientInitializationError: Environment variable not found:
  DATABASE_URL`** — there's no `.env` file in the project root. It's
  committed to the repo, so this should only happen if it was deleted or
  `git clone` somehow didn't bring it — check `ls .env` and re-clone if
  it's missing.
- **Login returns "Invalid credentials"** — the database exists but has no
  users; run `npm run db:seed`.
- Any other login failure will now print a full stack trace in the
  terminal running `npm run dev` (see `src/lib/api.ts`'s `apiError`) —
  that trace is the fastest way to diagnose it.

Open http://localhost:3000. Seeded logins (see `prisma/seed.ts`):

| Role | Login |
|---|---|
| Admin | `admin@acme.test` / `admin1234` |
| Publisher (checker) | `publisher@acme.test` / `admin1234` |
| Author (maker) | `author@acme.test` / `admin1234` |
| Employee | `employee@acme.test` / `admin1234` |
| Vendor Admin | mobile `9800000001`, OTP login |
| Vendor User | mobile `9800000002`, OTP login |

In development, OTP requests echo the code in the API response
(`devCode`) and the login screen so the flow is testable without a real SMS
gateway — this is disabled automatically when `NODE_ENV=production`.

## Architecture

```
prisma/schema.prisma        Full data model (see below)
prisma/seed.ts               Demo tenant/users/vendor org/policy/quiz seed
src/lib/                     Domain logic, framework-agnostic
  auth.ts                    JWT session issue/verify, RBAC guards
  policies.ts                Policy version state machine (draft → publish → recall)
  targeting.ts                Resolves TargetRules → concrete employee/vendor-user ids
  consumption.ts              Audience-scoped visibility for the consumption portal
  attestation.ts              Immutable, hashed attestation records
  audit.ts                    Hash-chained tamper-evident audit log
  notify.ts                   Pluggable notification adapter (console/log by default)
  otp.ts                      Vendor OTP issue/verify
  quiz.ts                     Daily question selection, shuffling, scoring
  coverage.ts                 Coverage checklist status derivation + % calculation
  rbi-scraper.ts              Live scraper for rbi.org.in notifications
  vendor-upload.ts            CSV/XLSX bulk vendor-user import
  docx.ts / storage.ts        .docx → HTML conversion, local file storage
src/app/api/                 Route handlers (REST-ish JSON API)
src/app/admin/               Admin/Publisher/Author console
src/app/portal/              Employee + vendor consumption portal (webview)
src/app/login, /vendor/login Auth entry points
scripts/                      Standalone cron entry points (rbi:scrape, policies:expire)
```

### Data model highlights

- **Multi-tenant**: every domain table carries `tenantId`.
- **SQLite has no native enum type**, so former Prisma enums (`VersionStatus`,
  `EmployeeRole`, etc.) are stored as validated strings — see
  `src/lib/enums.ts` for the canonical value lists and TypeScript union types.
  This also means switching to Postgres is a one-line datasource change with
  no model rewrite required.
- **PolicyVersion** is the unit of the maker-checker/publish lifecycle;
  **Policy** just holds a pointer (`currentVersionId`) to whichever version is
  live. Publishing snapshots the resolved audience into `AudienceMember` so
  read receipts/attestations/reporting are always scoped to who a version was
  actually sent to, not who currently matches the targeting rules.
- **Attestation** and **AuditLog** rows store a SHA-256 hash — `AuditLog` rows
  are hash-chained (each row's hash covers the previous row's hash), so any
  row edited after the fact breaks the chain. Verify from Admin → Security.

## Auth — the AD / SSO swap point

Per the request, this build does **not** integrate real Active Directory /
SAML SSO. Instead:

- **Employees** log in with email + password (`src/app/api/auth/employee/login`).
  The `User` model has an `authSource` field (`MANUAL` | `AD_SYNC`) and an
  `adObjectId` column already in place so a real AD sync job can start
  writing `AD_SYNC` rows without a schema change. Swapping in real SSO means
  replacing the login route with a SAML/OIDC callback handler that calls the
  same `createSession()` helper — nothing downstream (RBAC, targeting,
  attestation) needs to change.
- **Vendor users** log in with mobile + OTP — this part is real, not a
  placeholder (`src/lib/otp.ts`, backed by the `OtpCode` table).

## Switching to Postgres

1. `prisma/schema.prisma`: change `provider = "sqlite"` to `provider = "postgresql"`.
2. Set `DATABASE_URL` to a Postgres connection string.
3. `npx prisma db push` (or set up `prisma migrate` for real migrations).

No model changes are needed — JSON-ish fields are already stored as `String`
(app-level `JSON.stringify`/`JSON.parse`) for SQLite compatibility, which
works identically on Postgres.

## What's a working feature vs. a documented stub

**Fully working, real implementations:**
- Vendor org + vendor-user registry, CSV/XLSX bulk upload, org-cascade deactivation
- Vendor mobile-OTP login and OTP-based attestation re-verification
- WYSIWYG editor (Tiptap), `.docx` → HTML import (mammoth), `.pdf` upload + built-in viewer (react-pdf)
- Single-level maker-checker approval workflow (maker ≠ checker enforced)
- Attribute-based + named-individual + custom-list targeting, with a live audience preview
- Publish / recall / resend-all / remind-unread-only / expiry / version history
- Consumption portal: folders, chronological feed, unread badges, full-text search, starring, per-user/vendor audience isolation
- Attestation (employee password re-verify, vendor OTP re-verify) with immutable hashed records
- Read receipts, attestation dashboard (employee vs. vendor split, per-vendor-org drill-down), CSV export
- Daily Micro-Quiz: shuffled question/option order, instant feedback, deep link back to the policy section, per-user/per-team scoring
- Policy Coverage Checklist, seeded with the 30-item Collections & Recovery template (Appendix A), live status derived from linked policies, coverage %
- **RBI notifications scraper is live** — it fetches and parses `rbi.org.in`'s actual notification list, tags NBFC/Co-operative Bank/Small Finance Bank/Bank by keyword heuristics, and can import a circular as a draft policy starting point
- Hash-chained audit log with an integrity verification endpoint
- Tenant-wide pending-consent metric with drill-down (name, employee/vendor, agency, document, pending-since)
- Editable expiry on a live published version (not just at publish time), plus an "expiring soon" dashboard widget
- Per-webview-open access log with request-level technical detail (IP, browser/OS, identity, timestamp) — `Admin → policy → Access logs`
- Per-document report metrics panel (sent/read/unique users/total views/accept/helpful/questions + first-response day-bucket distribution)
- Consumption webview action bar: Sign (attestation) / Helpful / Not Helpful / Ask a question, with an admin-side answer flow for questions

**Intentionally stubbed / documented limitations:**
- **AD/SAML SSO** — see [above](#auth--the-ad--sso-swap-point); explicitly out of scope for this build
- **AD scheduled sync** for adds/moves/leavers — the `User` model has the columns (`authSource`, `adObjectId`) ready for it, but no sync job is implemented
- **Email/SMS delivery** — `src/lib/notify.ts` defines a pluggable
  `NotificationAdapter` interface; the default implementation logs to the
  console/DB instead of calling a real ESP/SMS gateway. Swap `activeAdapter`
  for a real provider (SES/SendGrid, Twilio/MSG91) without touching call sites.
- **RBI circular summaries** are title-based (the notification listing page
  doesn't expose body text); `pdfUrl` is captured on every scraped row so a
  future PDF-text-extraction job can generate real abstracts without a schema change
- **IP allow-listing** for the admin console is modeled and manageable from
  Admin → Security, but enforcement belongs at the reverse proxy / edge
  middleware layer in a real deployment (documented, not wired into
  Next.js middleware, to avoid a fragile edge-runtime dependency on the
  Node-only Prisma/SQLite client used here)
- **TLS / at-rest encryption** are infrastructure-layer concerns (load
  balancer + managed Postgres disk encryption in production) — not something
  an application-layer scaffold enforces itself
- **AI-generated quiz questions** — explicitly Phase 2 per the request; question authoring is manual in this build

## Scheduled jobs

Two standalone scripts are provided for cron/Task Scheduler wiring:

```bash
npm run rbi:scrape        # scrapes rbi.org.in and upserts RbiCircular rows
npm run policies:expire   # auto-unpublishes any PUBLISHED version past its expiresAt
```

## Security notes

- Passwords are hashed with bcrypt; OTP codes are hashed (SHA-256) at rest with a 5-minute expiry.
- Sessions are httpOnly, `sameSite=lax` JWT cookies.
- Vendor users are hard-isolated: the consumption API only ever resolves
  policies via `AudienceMember` rows scoped to the caller's own
  `userId`/`vendorUserId` — there is no code path that lets a vendor user
  query another vendor org's or another tenant's data.
- Vendor role never has access to export/CSV endpoints (`/api/reports/**`
  requires `ADMIN`/`PUBLISHER`, both employee-only roles) — downloads are
  disabled by default for vendor users per the security baseline.
