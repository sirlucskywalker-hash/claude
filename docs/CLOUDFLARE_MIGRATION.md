# Cloudflare Pages migration

Status (October 15, 2026 UTC): the existing Cloudflare account is connected. The `physiqueos` Pages project is connected to `sirlucskywalker-hash/claude`, production branch `main`, with automatic production deployments enabled and preview deployments disabled. The first Git build deployed commit `706dae4c11e196693e9e30a5b060193219ffc9cb` successfully to https://physiqueos.pages.dev. Authentication, server origin settings, real account/device tests and automatic rebuild verification remain cutover gates. GitHub Pages remains available. Paid enrollment stays closed.

## Production setup

Use the existing Cloudflare account and inspect Workers & Pages for an existing PhysiqueOS project before creating one. If none exists, create a **Pages Git integration** project using only `sirlucskywalker-hash/claude`. Proposed project name: `physiqueos`; the actual pages.dev hostname must be copied from Cloudflare's deployment result, never assumed available.

| Setting | Value |
|---|---|
| Production branch | main |
| Framework preset | None |
| Repository root directory | / (leave blank) |
| Build command | npm run build:pages |
| Build output directory | dist-pages |
| Node version | 22 |

The build runs all behavioral tests and then copies an explicit public file allowlist. Do not deploy the repository root. No Supabase service-role, Stripe, Resend, or other private keys belong in Pages build variables: these remain server-only Supabase function secrets. No new database, Stripe catalog or edge functions are required for hosting migration.

Enable production deployment on main. Keep preview deployment origins outside production Auth callbacks and billing origins; preview pages use the production project's publishable key and must retain the normal account/data controls. If Cloudflare GitHub authorization is needed, request access only to this repository, including after it becomes private.

## Cutover gates

1. Verify Cloudflare's successful deployment SHA matches current main; check app, owner dashboard, styles, scripts, icons, manifest, service worker, error page and security headers.
2. Confirm a subsequent main commit automatically deploys, without a manual upload.
3. Copy the actual production URL into Supabase Auth Site URL and add exact root/index callback URLs. Temporarily retain the verified GitHub callbacks for existing messages, then remove them after migration. Never use broad wildcard production callbacks.
4. Set server-only Supabase `SITE_URL` to the Cloudflare origin/root, and update configured Stripe portal return URL and lifecycle email links. The billing functions allow only that exact origin. Configure these through authenticated administration, not public code or chat.
5. Test real signup, original email confirmation, login, password recovery, invited beta claim, owner access, cloud synchronization, photo access and mobile/PWA behavior on the new origin. Existing signed-in sessions and localStorage do not move across origins. Sync/export old device-only data before changing hosts; signing into Cloudflare loads cloud records. An installed GitHub PWA must be replaced with the new installation after saving local data.
6. Keep paid enrollment off until sandbox payment and other launch gates pass on the new origin.
7. Only after the above pass, retire GitHub Pages (an explicit forwarding page can temporarily preserve old links). Repository privacy is a separate administration action: verify Cloudflare can read the private repo and that the working GitHub connector retains access before changing visibility. Preserve the repo for version control and automatic deployment.

## Rollback

Keep GitHub Pages and its successful deployment available during validation. If Cloudflare fails before cutover, continue using GitHub. After changing origins, rollback requires restoring Supabase Auth callbacks/Site URL, server SITE_URL and portal/email return settings together. Never simply redirect traffic while billing/CORS point to a different origin.

## Remaining account actions

Verify an automatic deployment from a subsequent main commit. Then set Supabase Auth Site URL to `https://physiqueos.pages.dev/` and add exact redirects `https://physiqueos.pages.dev/` and `https://physiqueos.pages.dev/index.html`, temporarily retaining the existing GitHub redirects. Coordinate server-only `SITE_URL`, portal return links and lifecycle email settings as described above. Verify real account/device behavior before retiring GitHub Pages or changing repository privacy. No provider secrets belong in the repository or Pages build variables.
