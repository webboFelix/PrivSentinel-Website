# PrivSentinel website

A responsive Next.js site for the Windows-first PrivSentinel endpoint security application. It follows the supplied navy-and-cyan visual reference, lists stable releases from the configured GitHub repository, and gates installer downloads behind a complete authenticated account.

The desktop application itself is not part of this repository. The landing page uses a CSS interface preview rather than presenting an unavailable desktop screenshot as a real product capture. The demo player displays an honest fallback until a video URL is configured.

## Technology

- Next.js App Router, React, TypeScript, Tailwind CSS
- Turso (LibSQL) with Drizzle ORM and Drizzle Kit
- Better Auth email/password and optional Google OAuth
- Stripe-hosted card verification and tokenized payment-method storage
- Zod request and registration validation
- Lucide React icons
- GitHub Releases API for stable version and installer metadata
- Vitest unit tests

## Prerequisites

- Node.js 22 or newer and npm
- A Turso database and auth token for accounts, profile details, release cache, downloads, and audit events
- Google OAuth credentials to enable Google sign-in
- A Gmail account with 2-Step Verification and an app password to deliver password-reset and email-verification links
- A Stripe account and server-side secret key to enable card verification
- The configured public GitHub releases repository

## Install and configure

From `privsentinel-website`:

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

The root `.env` is ignored by Git. Put actual credentials only in `.env` (or your hosting provider's secret environment settings), never in source code or `NEXT_PUBLIC_` variables. `.env.example` contains variable names and non-secret defaults only.

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso `libsql://` database URL |
| `TURSO_AUTH_TOKEN` | Private Turso access token |
| `BETTER_AUTH_SECRET` | Random secret of at least 32 characters |
| `BETTER_AUTH_URL` | Canonical origin used for auth callbacks, e.g. `http://localhost:3000` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Optional server-only settings for storing profile photos in Cloudinary; set all three as Vercel environment variables to enable avatar uploads |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials; set both or leave both blank |
| `INITIAL_SUPER_ADMIN_EMAIL` | Email of the account allowed to perform the one-time initial super-admin setup |
| `GITHUB_OWNER` / `GITHUB_REPO` | Releases repository (defaults in `.env` use the repository supplied for this project) |
| `GITHUB_TOKEN` | Optional server-only GitHub token to increase API rate limits; never expose it to the browser |
| `NEXT_PUBLIC_APP_URL` | Public canonical app URL; never put secrets in this variable. For shared local/production env files, local and production URLs may be separated with ` || `; development uses the first and production uses the last. |
| `NEXT_PUBLIC_DEMO_VIDEO_URL` | Optional HTTPS video URL or local `/videos/...` path |
| `GMAIL_SMTP_USER` | Gmail address used as the server-side SMTP sender |
| `GMAIL_APP_PASSWORD` | Gmail app password for SMTP; server-side secret only, never use the regular Google password |
| `STRIPE_SECRET_KEY` | Optional server-only Stripe key (`sk_test_...` for testing, `sk_live_...` for production); never expose it with a `NEXT_PUBLIC_` prefix |

Generate a signing secret locally instead of reusing a password:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Copy the output into `BETTER_AUTH_SECRET` in `.env`. For email, enable 2-Step Verification on the Gmail account, create a Google App Password, then set `GMAIL_SMTP_USER` and `GMAIL_APP_PASSWORD`. App passwords are only available for eligible Google accounts with 2-Step Verification; use a dedicated sender mailbox and never use its regular account password. Keep the app password in a server-side secret store. Leave credentials blank until you have the real provider values. Authentication and protected downloads require `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and a `BETTER_AUTH_SECRET` of at least 32 characters. If any are missing or invalid, login and registration explain that authentication is unavailable, and `/api/auth/*` returns a sanitized `503` without initializing the database or exposing configuration values. The public landing and release API can still be viewed without credentials.

## Turso and Drizzle

Create a database in Turso, then set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env`. Generate reviewed SQL migrations after changing `src/db/schema.ts` and apply them to the configured database:

```powershell
npm run db:generate
npm run db:migrate
```

The app also initializes and upgrades its schema at startup through `ensureDatabaseSchema` in `src/db/index.ts`. The location and legacy-profile upgrades are applied there idempotently; Drizzle migrations `0004` and `0005` are no-op journal markers so running `db:migrate` before or after application startup cannot repeat their non-idempotent DDL. Keep runtime upgrades transactional/idempotent when changing this flow, and back up production data before deploying schema changes.

The schema includes Better Auth's `user`, `session`, `account`, and `verification` tables, plus `profile_details`, `billing_customers`, `payment_methods`, `releases`, `release_overrides`, `downloads`, `audit_logs`, `rate_limits`, `testimonials`, and the one-time `admin_bootstrap` marker. The existing `testimonials.quote` column remains the stored review message for backward compatibility. Do not replace the authentication tables with a separate password or session implementation.

### Data relationships and ownership

- `user` is the canonical identity row. Better Auth's `user.name` is the single source of truth for the user's full name; account edits update it directly.
- `profile_details.userId` is a one-to-one extension of `user.id` and holds optional/required profile fields and the Cloudinary avatar URL. It has no separate copy of the user's name.
- `session`, `account`, `profile_details`, `billing_customers`, `payment_methods`, and `downloads` reference `user` and are removed with it. `downloads.releaseId` references a shared `releases` record; release data is not user-owned.
- `testimonials.userId` links a review to its author. New linked reviews display `user.name` and store only a generic fallback in the review row; old or anonymous unlinked reviews retain their display-name snapshot. `reviewedBy`, `release_overrides.updatedBy`, `admin_bootstrap.completedBy`, and audit actor references are nullable references to `user`.
- `release_overrides` and `releases` are shared site data; they are not deleted when a user account is deleted.

At startup, the runtime schema migration consolidates the legacy `profiles` table into `user` + `profile_details`: it copies `fullName` into `user.name`, moves `phoneNumber` into `profile_details`, then removes the duplicate table in a write transaction. Do not manually drop tables or edit production data.

### Request and profile flow

1. Better Auth authenticates the request. Protected Route Handlers call `getPrincipal` and authorize against the server-side user row before reading or mutating user data.
2. The account page reads `user.name` and its `profile_details` row through `/api/profile`. Profile edits update the canonical name and profile extension in one database batch; independent browser form drafts stay in component state.
3. Avatar bytes are sent to the authenticated avatar Route Handler, validated there, and uploaded with a server-generated Cloudinary signature to `privsentinel/profile_images/<user-hash>`. Only the returned HTTPS URL is stored in `profile_details.avatar`; Cloudinary credentials never reach the browser.
4. The navbar and account page share the same in-memory profile query. The query cache is not persisted; the only persisted browser value is the non-sensitive navigation density preference.

### Account deletion flow

1. The authenticated user types `DELETE` in Account settings and confirms. The browser sends the Better Auth `delete-user` request; Better Auth validates the session and expires the session cookie.
2. Before deleting the identity row, the server removes the user's Stripe customer (if present), Cloudinary avatar (if present), authored testimonials, personal audit records, email-verification records, and user-scoped rate-limit keys. Failure to remove an external billing or image resource prevents deletion and returns an error so the user can retry.
3. Better Auth deletes the `user` row. Foreign-key cascades remove linked sessions, provider credentials, profile details, billing/payment records, and download history; `SET NULL` relationships preserve only non-user-owned records where applicable.
4. On success, the browser clears the TanStack Query cache and persisted `privsentinel-ui-preferences` preference, then redirects to the home page. No auth tokens or profile data are stored in localStorage.

Before handling a Better Auth API request, the server runs idempotent table creation, missing-column upgrades, and the legacy-profile migration. This bootstraps a new or existing database without requiring a separate migration command; keep this runtime path synchronized with `src/db/schema.ts` and preserve the migration ordering documented above.

Existing testimonials are backfilled as approved only if they already have an `approvedAt` timestamp, but legacy rows do not receive public-display consent and therefore remain hidden. New reviews are private by default and require both explicit public consent and an administrator approval before `/api/testimonials` returns them. No reviews or ratings are seeded or fabricated.

## Better Auth and Google OAuth

Better Auth serves its endpoints at `/api/auth/*`. Email/password signup uses Better Auth password hashing and session cookies. The profile endpoint stores the required full name and normalized international phone number separately; an account without a phone number cannot download.

For Google OAuth:

1. Create a Google OAuth web client and add the canonical site origin as an authorized JavaScript origin.
2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`/deployment secrets.
3. Add `${BETTER_AUTH_URL}/api/auth/callback/google` as an authorized redirect URI.
4. After OAuth, the user is sent to profile completion before download access is enabled.

Password reset and email verification use Gmail SMTP over TLS on `smtp.gmail.com:465`. Configure `GMAIL_SMTP_USER` and `GMAIL_APP_PASSWORD` locally and as server-only Vercel environment variables; the sender is the configured Gmail account. Reset requests intentionally return a generic success message to avoid account enumeration.

## Profile photos and billing cards

The Account page has a profile-photo control; PNG, JPEG, and WebP files up to 5 MB are stored as private account profile data in Turso. Gender is required during registration/profile completion and cannot be changed after it is saved; the saved selection is displayed without the radio options. Organization and current position are optional.

To enable card setup, set `STRIPE_SECRET_KEY` in `.env` (use a Stripe test-mode secret key during development). The app redirects to Stripe Checkout in setup mode, which verifies and attaches a card to that account without charging it. On return, the server verifies the completed Checkout Session and SetupIntent belong to the signed-in user before saving the Stripe payment-method ID and non-sensitive card display details (brand, last four digits, and expiry) in Turso. The application never receives or stores the full card number or security code. Stripe keys are server-only. Configure your Stripe account and payment method settings before production use.

## GitHub Releases and video

The server calls `GET https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases` with a five-minute revalidation window. A token is optional for public repositories; if configured, `GITHUB_TOKEN` stays server-side and can increase API limits. Only published, non-draft, non-prerelease releases are considered stable. The latest stable release is selected dynamically, `.exe` assets are preferred as the installer, and ZIP assets are not used as the primary download.

Release notes, dates, Windows installer size and GitHub download count are shown when available. The website streams the installer through `/api/downloads/latest` only after checking the Better Auth session, the completed profile, rate limit, and exact configured repository/release/asset path.

Set `NEXT_PUBLIC_DEMO_VIDEO_URL` to an authorized HTTPS MP4/WebM video or a file under `public/videos/`. With no source configured, the page displays the video fallback and does not invent a video URL.

## Local development

```powershell
npm run dev
```

Open `http://localhost:3000`. To use registration/download flows locally, set up Turso and run the migrations first.

The public site uses separate App Router pages for `/about`, `/features`, `/security`, `/demo`, `/download`, `/help`, `/faq`, `/privacy`, and `/terms`, alongside the existing authentication and account routes. Navigation is route-based and does not rely on home-page hash anchors.

## Tests and checks

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
```

Tests cover registration and phone validation, stable-release filtering and ordering, Windows installer selection, profile download eligibility, role hierarchy, suspension decisions, and testimonial rating/consent/identity validation. Authentication and database-backed flows also require an integration environment with valid Turso and OAuth/email credentials.

The GitHub Actions security workflow runs TypeScript/ESLint/tests, CodeQL SAST, npm dependency auditing, Gitleaks secret scanning, CycloneDX SBOM generation, and an OWASP ZAP baseline scan against the built application. The SBOM is uploaded as a workflow artifact.

## Roles, bootstrap, and administration

The only role field is Better Auth's server-controlled `user.role`; registration always defaults to `user`, and signup requests cannot set it. Admin APIs re-read the authenticated user's current role from Turso and enforce hierarchy on the server. Administrators may manage regular accounts, while only a super administrator may manage administrator roles; no account may change its own role. Suspensions revoke existing sessions, and suspended users are blocked from protected operations. The dashboard is `/admin`.

To initialize the first super administrator:

1. Apply the reviewed migrations to Turso and deploy the app.
2. Set `INITIAL_SUPER_ADMIN_EMAIL` to the exact email intended for the first administrator. Keep it server-side; never use a `NEXT_PUBLIC_` prefix.
3. Configure `GMAIL_SMTP_USER` and `GMAIL_APP_PASSWORD`. Email/password registration and sign-in require email verification; Better Auth sends verification links through Gmail SMTP.
4. Register or sign in with the designated account, then open its email verification link. For an existing signed-in account, `/admin/bootstrap` can send a rate-limited verification email.
5. Visit `/admin/bootstrap` and select **Initialize super administrator**. The endpoint confirms the authenticated account is the configured email and that Turso marks it verified, promotes it transactionally, and records a one-time completion marker. Bootstrap attempts are rate-limited per account and source address and will not replace a different existing super administrator.
6. After setup, remove `INITIAL_SUPER_ADMIN_EMAIL` from the deployment and redeploy. The database completion marker prevents the bootstrap flow from running again.

Do not grant roles by accepting client-submitted role values or by adding a public role-assignment endpoint. For later administration use the protected dashboard. Role changes, suspensions, releases, review moderation, authentication, and downloads are audited. User reviews can be edited or deleted by their owner; approved reviews are public only when the author gave display permission.

The admin overview includes account totals, role distribution, recent registrations and activity; user search/details/role and status management; testimonial moderation; release metadata and publication controls; download counts; and read-only security/audit activity. Release installer files remain in GitHub Releases. Release metadata overrides live in Turso.

## Vercel deployment

Import the Git repository into Vercel and keep the detected Next.js framework settings. The project uses Next.js's standard `npm run build` command and Node.js runtime; no platform adapter or custom output directory is required. Add the required server-side values from `.env.example` in the Vercel project's Environment Variables settings for Production and Preview as appropriate. Do not expose secrets with a `NEXT_PUBLIC_` prefix.

Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the canonical production origin, and set the Google OAuth redirect URI to `${BETTER_AUTH_URL}/api/auth/callback/google`. Add `GMAIL_SMTP_USER` and `GMAIL_APP_PASSWORD` as server-only variables for email verification and password-reset delivery. Add all three Cloudinary settings as server-side variables if avatar uploads are enabled.

Apply and review Turso migrations from a trusted environment before enabling account workflows. Vercel deploys automatically from the connected Git repository; the standard `npm run build` script is also used for local production-build checks. The dependency-free `/api/health` route is available for basic deployment health checks.

Run database migration commands from a trusted deployment environment with the correct Turso URL and token:

```powershell
npm run db:generate
# Review the generated SQL, especially changes to existing data and constraints.
npm run db:migrate
```

Do not run migrations against a production database until the generated SQL has been reviewed and the deployment is authorized.

## Security and privacy notes

- The installer endpoint requires an authenticated session and a complete profile on the server; hiding a button in the browser is not the security boundary.
- The endpoint rate-limits downloads and streams only the current stable `.exe` after validating its GitHub repository, release tag, asset name, and HTTPS host. The request is recorded in Turso without storing download IP addresses or user agents.
- Authentication uses Better Auth's CSRF/session protections. Profile writes validate same-origin requests. Common security headers are configured in `next.config.ts`.
- GitHub release assets may be publicly accessible at GitHub URLs. Account gating protects access through this website; it cannot prevent a person from sharing an installer they already downloaded or a public release URL.
- The site stores account email/name, required profile phone number and gender, and optional location/avatar/organization/position, download history, release metadata, and minimal audit events. Profile image uploads are limited to 1 MB. If Stripe billing is configured, it also stores Stripe customer/payment-method identifiers and non-sensitive card display details; raw card numbers and security codes are never stored. Do not collect extra personal or device data without a documented purpose and privacy disclosure.
- New profile photo uploads are validated and signed server-side, stored in Cloudinary under `privsentinel/profile_images/`, and saved in Turso as secure image URLs. Configure the three Cloudinary settings above as server-side Vercel environment variables; do not prefix them with `NEXT_PUBLIC_` or commit their values. Older avatar data URIs remain readable until the account owner uploads a replacement; account deletion also attempts to remove legacy `privsentinel/avatars/` objects.
- Never commit `.env`; keep all credentials out of browser bundles and logs. Review the application's privacy notice and applicable data-protection obligations before public launch.
