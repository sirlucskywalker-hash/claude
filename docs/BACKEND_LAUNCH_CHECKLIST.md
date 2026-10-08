# Backend launch status — October 1, 2026

The backend code is implemented for the current web beta. Paid launch and lifecycle email delivery remain blocked by the configuration and end-to-end checks below. This is not a claim that the full premium wellness product is complete.

## Deployed database and server capabilities
- Supabase Auth with email confirmation enabled and an in-app confirmation-link fallback that validates the project origin and bound email; private user data and account isolation.
- Exact-tier entitlements, closed enrollment flags, Founding capacity reservations, invitation claims, owner/admin reporting and support replies.
- Revision-controlled cloud state; normalized profile, check-in, measurement and workout reporting.
- Private progress-photo bucket, owner-folder Storage policies, metadata ownership constraint; explicit upload and photo download/delete interface.
- Bounded, own-account record exports including device recovery copies; no internal coaching notes or raw billing events.
- Audited, idempotent account deletion requests and an owner-visible queue. Actual account erasure still requires an operator workflow; a request does not cancel billing.
- Privately allowlisted, verified-email owner bootstrap. Owner email is seeded in the private database, absent from public source. Account metadata cannot grant owner access.
- Welcome, subscription activation, plan change, scheduled cancellation, cancellation reversal, payment issue, membership exit, and deletion-request notifications.
- Owner operations health counts for queues, payment issues and scheduled cancellations; private support replies notify members without including support content in email.
- Server-owned in-app notifications with own-account reads and controlled mark-read operations.
- Durable transactional email outbox, bounded retries, stable idempotency keys, concurrent-worker leases, verified delivery webhooks, bounce/complaint suppression.
- A live daily database job queues at most one in-app return-to-plan nudge per week, honors communication preferences and excludes pending deletion requests. Marketing email is disabled.
- Explicit Stripe portal configuration policy: immediate prorated upgrades, period-end lower-price / shorter-interval changes, period-end cancellation, cancellation reasons, invoice history and payment-method management. Founding is excluded from switch-in options.
- Automated behavioral tests must pass before Pages deployment; only public app assets enter the hosting artifact.

## Required before calling the backend launch-ready
- [ ] Correct Supabase Auth Site URL and allowlist: `https://sirlucskywalker-hash.github.io/claude/` and `https://sirlucskywalker-hash.github.io/claude/index.html`. Dashboard authentication is required to inspect/save these settings.
- [x] Selected Gmail owner account is verified; owner role and free workspace entitlement are assigned. Sign in through the app without a beta code.
- [ ] Configure server-only Stripe key, webhook secret, actual `SITE_URL`, and `STRIPE_PORTAL_CONFIGURATION_ID`.
- [ ] Run `scripts/configure-billing-portal.mjs` in a Stripe sandbox, verify current product/price IDs, then configure the intended live portal. Do not use the script to silently change pricing.
- [ ] Register the Stripe webhook and run sandbox purchase, renewal, retry, cancellation, downgrade, upgrade/proration and payment-failure checks. Confirm no duplicate charge or access grant.
- [ ] Verify a Resend sending domain with SPF/DKIM and publish DMARC. No sending domains existed at the latest check.
- [ ] Configure `RESEND_API_KEY`, verified `FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, and a long random `LIFECYCLE_WORKER_SECRET` in Edge Function secrets.
- [ ] Register the Resend webhook for sent/delivered/delayed/failed/bounced/complained events; verify signatures and suppression with test events.
- [ ] Schedule the email worker with a server-owned secret in Vault. The worker accepts only POST and its private token. Nothing in the browser can drain the email queue.
- [ ] Complete email delivery and cross-client rendering checks. "Sent" in the queue means provider accepted, not proven delivered.
- [ ] Test signup, verification redirect, reset, owner claim, beta invite, cross-device sync, photo upload/download/delete, and export with real user sessions.
- [ ] Approve and publish terms, privacy, billing/cancellation and retention policies; record consent versions in the signup flow. No zero-chargeback/no-refund guarantee is implemented.
- [ ] Establish account deletion handling, financial-record retention, monitoring/alerts, backup/restore verification and incident handling.
- [ ] Establish separate staging/production environments before broader release.

## Operating rules
Paid enrollment stays closed until the billing checks pass. Existing Founding promises are unchanged. New higher-tier pricing is a proposal until actual price/catalog changes are authorized. Human services are not marked delivered by automated notifications. Native push, connected AI voice, wearables, camera analysis and 24/7 human staffing remain separate product work.

## Latest security advisor follow-up
No anonymously executable public SECURITY DEFINER functions were found. Twenty authenticated SECURITY DEFINER RPCs are intentional, narrow operations with identity/role checks; review guidance: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable . Four server-only tables intentionally have RLS without browser policies. Leaked-password protection is currently disabled and must be evaluated/enabled where supported before release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . These checks are not an independent security audit.

## Execution verification — October 1, 2026
The three preceding application deployments completed successfully. All eleven database migrations and five active Edge Functions are deployed; the daily retention job is enabled. The complete local behavioral suite passes 44 scenarios. No unfinished execution was found in the prior deployment runs. Remaining unchecked items are configuration, real-service validation, and operational launch work, not a frozen deployment.
