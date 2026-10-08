# Launch execution — October 7, 2026

Paid enrollment remains closed. No live charges, vendor purchases, pricing changes, Stripe branding changes, or production secret changes were made.

## Implemented and tested
- Password recovery isolates the password-update screen, pauses sync, hides signup controls, and loads account access only after a successful password update. Rejected passwords leave recovery open. No async Supabase call runs inside the auth event callback.
- Added 180px Apple home-screen icon and 192px/512px PNG manifest icons, app identity and scope. Icons use a code-drawn monogram.
- The service worker caches only successful HTTP responses and waits for cache writes. Cache version 63 includes icons and updated cloud client.
- Full local behavioral suite passes 46 scenarios (plus the enclosing database test). Two new scenarios cover recovery success and rejection. These are simulated sessions, not real email delivery tests.

## Security review
Reviewed live definitions of the authenticated SECURITY DEFINER operations. Ownership checks use auth.uid(), verified Auth email, private allowlist, or organization membership, rather than user-editable metadata. The 17 advisor warnings identify intentionally exposed privileged operations; removing them indiscriminately would break account access. Server email/billing functions must remain service-role-only. Four RLS-without-policy notices refer to deliberately server-owned tables. This is a targeted review, not an independent audit.

Leaked password protection remains disabled and needs dashboard access and plan eligibility review. Review: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
Privileged RPC review: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Still unverified / blocked
- Supabase Auth redirect settings and real registration, confirmation, recovery, and cross-device sessions. Prior in-app confirmation fallback does not repair a misconfigured email redirect.
- Only the confirmed Apex Training Systems live Stripe account is exposed by the connector. No connected sandbox is available. Real sandbox checkout, signed webhook delivery, access grant, upgrade/downgrade, cancellation and refund handling are not verified.
- Billing secrets, webhook endpoint and portal configuration remain prerequisites; sending email requires verified domain/sender, worker secrets and scheduling.
- Actual account erasure, signup policy consent, approved legal policies/support details, backup restore and monitoring remain launch gates.
- Physical iPhone Add to Home Screen, offline reload, keyboard layout, notification permission and app update behavior need device checks. Manifest icons alone do not establish PWA readiness.

## Release rule
Do not open a tier until its actual capabilities and payment lifecycle pass. Use the existing runbook and issue #1 to track evidence. App Store distribution follows revenue-funded Apple enrollment; this web build is not an App Store submission.
