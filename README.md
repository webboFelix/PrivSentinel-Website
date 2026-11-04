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
- A Turso database and auth token for accounts, profiles, release cache, downloads, and audit events
- Google OAuth credentials to enable Google sign-in
- An email provider (Resend) to deliver password-reset links
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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials; set both or leave both blank |
| `INITIAL_SUPER_ADMIN_EMAIL` | Email of the already registered account allowed to perform the one-time initial super-admin setup |
| `SUPER_ADMIN_BOOTSTRAP_SECRET` | Server-only random secret (at least 32 characters) required for initial super-admin setup; set together with the email |
| `GITHUB_OWNER` / `GITHUB_REPO` | Releases repository (defaults in `.env` use the repository supplied for this project) |
| `GITHUB_TOKEN` | Optional server-only GitHub token to increase API rate limits; never expose it to the browser |
| `NEXT_PUBLIC_APP_URL` | Public canonical app URL; never put secrets in this variable |
| `NEXT_PUBLIC_DEMO_VIDEO_URL` | Optional HTTPS video URL or local `/videos/...` path |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Optional password-reset delivery; set both to enable email reset |
| `STRIPE_SECRET_KEY` | Optional server-only Stripe key (`sk_test_...` for testing, `sk_live_...` for production); never expose it with a `NEXT_PUBLIC_` prefix |

Generate a signing secret locally instead of reusing a password:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Copy the output into `BETTER_AUTH_SECRET` in `.env`. Leave credentials blank until you have the real provider values. Authentication and protected downloads require `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and a `BETTER_AUTH_SECRET` of at least 32 characters. If any are missing or invalid, login and registration explain that authentication is unavailable, and `/api/auth/*` returns a sanitized `503` without initializing the database or exposing configuration values. The public landing and release API can still be viewed without credentials.

## Turso and Drizzle

Create a database in Turso, then set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env`. Generate reviewed SQL migrations after changing `src/db/schema.ts` and apply them to the configured database:

```powershell
npm run db:generate
npm run db:migrate
```

The schema includes Better Auth's `user`, `session`, `account`, and `verification` tables, plus `profiles`, `profile_details`, `billing_customers`, `payment_methods`, `releases`, `release_overrides`, `downloads`, `audit_logs`, `rate_limits`, `testimonials`, and the one-time `admin_bootstrap` marker. The existing `testimonials.quote` column remains the stored review message for backward compatibility. Do not replace the authentication tables with a separate password or session implementation.

Before handling a Better Auth API request, the server also runs idempotent `CREATE TABLE/INDEX IF NOT EXISTS` statements for these tables. This bootstraps a new or empty database without a separate migration command. It does not alter existing tables when columns or constraints change; continue to generate and apply Drizzle migrations for schema updates.

Existing testimonials are backfilled as approved only if they already have an `approvedAt` timestamp, but legacy rows do not receive public-display consent and therefore remain hidden. New reviews are private by default and require both explicit public consent and an administrator approval before `/api/testimonials` returns them. No reviews or ratings are seeded or fabricated.

## Better Auth and Google OAuth

Better Auth serves its endpoints at `/api/auth/*`. Email/password signup uses Better Auth password hashing and session cookies. The profile endpoint stores the required full name and normalized international phone number separately; an account without a phone number cannot download.

For Google OAuth:

1. Create a Google OAuth web client and add the canonical site origin as an authorized JavaScript origin.
2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`/deployment secrets.
3. Add `${BETTER_AUTH_URL}/api/auth/callback/google` as an authorized redirect URI.
4. After OAuth, the user is sent to profile completion before download access is enabled.

Password reset requires a verified sender and Resend API key. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; reset requests intentionally return a generic success message to avoid account enumeration.

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
2. Set `INITIAL_SUPER_ADMIN_EMAIL` to the exact email intended for the first administrator and `SUPER_ADMIN_BOOTSTRAP_SECRET` to a separate random secret of at least 32 characters. Keep both values server-side; never use a `NEXT_PUBLIC_` prefix.
3. Register that account (email/password or Google OAuth), then sign in as it.
4. Visit `/admin/bootstrap`, enter the bootstrap secret, and complete setup. The endpoint requires the signed-in designated account, checks that no super administrator or completed bootstrap exists, and records the promotion atomically.
5. Remove both bootstrap variables from the deployment and redeploy. The database completion marker also makes subsequent attempts non-promoting.

Do not grant roles by accepting client-submitted role values or by adding a public role-assignment endpoint. For later administration use the protected dashboard. Role changes, suspensions, releases, review moderation, authentication, and downloads are audited. User reviews can be edited or deleted by their owner; approved reviews are public only when the author gave display permission.

The admin overview includes account totals, role distribution, recent registrations and activity; user search/details/role and status management; testimonial moderation; release metadata and publication controls; download counts; and read-only security/audit activity. Release installer files remain in GitHub Releases. Release metadata overrides live in Turso.

## Production deployment

For Cloudflare Workers, use the repository's OpenNext adapter and the `npm run deploy` script. Configure all server-only values as encrypted Cloudflare secrets/variables, including `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `BETTER_AUTH_SECRET`; set production canonical URLs and apply reviewed Turso migrations before enabling account workflows. Google OAuth must use the production callback `${BETTER_AUTH_URL}/api/auth/callback/google`; configure the Resend sender for password reset.

`wrangler.jsonc` names the Worker `privsentinel` and binds `WORKER_SELF_REFERENCE` to the same service name. If Wrangler reports error 10143 that the referenced Worker does not exist, verify that the Worker has been created in the same Cloudflare account and that the deployment config's `name` and service binding both match its exact name. This is a deployment binding error, distinct from Worker runtime error 1101. Source-map upload is enabled; retain the OpenNext-generated maps when deploying so production stack traces can be mapped to source files.

The dependency-free `/api/health` route checks Worker request handling without touching Better Auth or Turso. For temporary runtime tracing, set the server-only `WORKER_DIAGNOSTICS=true` variable, reproduce one request, and then unset it. Diagnostic entries contain only fixed operation labels, state, elapsed time, and error class; they never include request data, credentials, cookies, or database URLs.

Cache Components/PPR are disabled in `next.config.ts`: local OpenNext preview reproduced 1101 on `/` with `cacheComponents: true`, including when `partialPrefetching` was false; the same routes returned 200 with Cache Components disabled. Re-enable only after validating the exact Next.js/OpenNext combination on a Cloudflare Worker runtime.

Run database migration commands from a trusted deployment environment with the correct Turso URL and token:

```powershell
npm run db:generate
# Review the generated SQL, especially changes to existing data and constraints.
npm run db:migrate
npm run deploy
```

Do not run migrations against a production database until the generated SQL has been reviewed and the deployment is authorized.

## Security and privacy notes

- The installer endpoint requires an authenticated session and a complete profile on the server; hiding a button in the browser is not the security boundary.
- The endpoint rate-limits downloads and streams only the current stable `.exe` after validating its GitHub repository, release tag, asset name, and HTTPS host. The request is recorded in Turso without storing download IP addresses or user agents.
- Authentication uses Better Auth's CSRF/session protections. Profile writes validate same-origin requests. Common security headers are configured in `next.config.ts`.
- GitHub release assets may be publicly accessible at GitHub URLs. Account gating protects access through this website; it cannot prevent a person from sharing an installer they already downloaded or a public release URL.
- The site stores account email/name, required profile phone number and gender, and optional avatar/organization/position, download history, release metadata, and minimal audit events. If Stripe billing is configured, it also stores Stripe customer/payment-method identifiers and non-sensitive card display details; raw card numbers and security codes are never stored. Do not collect extra personal or device data without a documented purpose and privacy disclosure.
- Never commit `.env`; keep all credentials out of browser bundles and logs. Review the application's privacy notice and applicable data-protection obligations before public launch.
