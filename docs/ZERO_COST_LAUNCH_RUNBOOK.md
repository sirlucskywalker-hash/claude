# PhysiqueOS — zero-new-spend launch runbook

Status: prelaunch. Owner approval required before live charges, public paid enrollment, or changes to production secrets.

## Go/no-go
- **Free pilot GO** only after live authentication, sync/data recovery, privacy/terms/support, and core features pass manual mobile testing.
- **Paid launch GO** only after sandbox checkout, signed webhook, entitlement assignment, portal cancellation, refund path, and tier availability pass end-to-end.
- **App Store GO** only after Apple Developer enrollment, compliant in-app purchase design, TestFlight and privacy disclosures.

## Execution sequence
1. Validate Pages URL, PWA manifest, HTTPS, icons, service worker and home-screen install. Capture screenshots from iPhone.
2. Test registration, verification and password reset with two ordinary test users and one owner. Validate that neither user can read the other's data.
3. Run `npm ci && npm test`, plus browser/device QA. Review SECURITY DEFINER functions individually; never blindly revoke access needed for normal flows.
4. Verify database backups/recovery, data export and deletion, account consent, support contact and health disclaimers.
5. Verify Stripe account ownership and product mapping; configure webhooks and secrets using authorized secure controls; run sandbox tests; keep paid enrollment closed until passing.
6. Start a limited free pilot, measure onboarding completion and weekly retention; resolve severe defects.
7. Open only tested paid tiers, publish transparent pricing and founding offer; use organic posts, waitlist and referrals. Never imply guaranteed health outcomes.
8. Allocate revenue to Apple Developer enrollment and native App Store distribution when economically justified.

## Current verified infrastructure
- GitHub: sirlucskywalker-hash/claude, main is publicly visible.
- Supabase project PhysiqueOS: ACTIVE_HEALTHY; 5 Edge Functions active.
- Public database tables have RLS enabled. Security advisor warns about privileged RPC exposure and leaked password protection disabled; requires review.
- Stripe connector exposes an account named Apex training systems; do not assume it is the intended PhysiqueOS merchant without owner confirmation.
- CHANGE_REVIEW.md says no verified end-to-end paid checkout and cancellation, and public paid tiers remain closed.

## Cost discipline
No new paid vendor, Apple membership, advertising, or recurring plan until revenue supports it and owner approves. Free tiers may have usage caps. Processor fees apply to transactions. Apple distribution requires its own developer membership; PWA web distribution does not.
