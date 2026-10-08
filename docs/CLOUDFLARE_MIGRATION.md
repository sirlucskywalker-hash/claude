# Cloudflare Pages migration

Status: deployment preparation only. No Cloudflare account, project or hostname has been verified. GitHub Pages remains available until the migration passes its gates. Paid enrollment stays closed.

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

Cloudflare sign-in and any displayed terms acceptance; inspect/reuse or create the project; authorize narrowly scoped GitHub integration if absent; verify actual production deployment and automatic rebuild; authenticate to Supabase to update Auth and server-only settings; real account/device validation; then retire GitHub Pages and optionally make the repo private. These account operations have not been performed by the preparation commit.
