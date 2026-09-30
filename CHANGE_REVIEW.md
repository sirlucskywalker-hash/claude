# PhysiqueOS backend change review
Prepared September 30, 2026. Base repository: sirlucskywalker-hash/claude, commit 9f04233.
Target Supabase project: PhysiqueOS (oyrtpvtzaoftinqoossn).

## Current status
Approved by the owner September 30, 2026. Migration 20260930230346 was applied successfully to production. All three billing handlers are ACTIVE at version 2. Matching client source was published in commit 347b04a; GitHub Pages deployment passed. The follow-up migration 20260930230928 removes anonymous execution of inherited privileged helper functions.
All 15 behavioral scenarios passed again after release. Live billing probe reports incomplete setup; Stripe still has no webhook endpoint.
Paid enrollment remains closed pending secure billing configuration and end-to-end verification.

## Prepared changes
- Exact purchased-tier access; remove the previous fallback that treated unspecified paid memberships as Pro.
- Transactional subscription/entitlement writes; repeat-event handling; older-event protection; cancellation handling.
- Current Stripe item-level subscription billing periods; invoice and asynchronous checkout event handling.
- Server-controlled enrollment availability; closed tiers reject checkout even if a client submits a price choice.
- Atomic Founding 100 reservations, duplicate-subscription prevention, and no Founding re-entry after cancellation.
- Same-origin checkout/portal redirects, pinned server dependencies, authenticated billing requests.
- Email-bound, repeat-safe beta invite claims; audited admin-created invitation links.
- Revision-based app sync, offline retry, account-specific caches, explicit legacy-data import consent, conflict backups.
- Normalize profile, daily check-ins, measurements, and workout records for staff reporting. Imperial values are converted to kilograms, centimeters, and milliliters.
- Owner dashboard for authorized members, raw member records, invitation creation, and support requests/replies.
- Server-calculated support priority.
- Five-tier comparison; future form analysis and wearables labeled planned and not granted as working features.
- Private progress photos remain device-local, now separated by account. Cloud photo upload/migration remains unfinished.

## Agreed pricing and comparison
| Version | Monthly | Annual | Intended difference |
|---|---:|---:|---|
| Invite-only beta | Free | — | Beta access without card |
| Founding 100 | $39 | — | Current Pro bundle, rate locked while continuously active; first 100 |
| Core | $29 | $290 | Training/nutrition, basic tracking/groceries, limited adaptation and monthly analysis |
| Pro | $59 | $499 | Full adaptive recommendations, advanced swaps/budget tools, weekly analysis, priority support |
| Elite | $119 | $999 | Pro plus deeper analysis; vision/form tools planned, pending a working delivery pipeline |
| Concierge | $349 | — | Elite plus direct coaching touchpoint and Lucas oversight; intake and seat limit required |

The public tiers remain closed. This does not start subscriptions, charge anyone, send email, or invite anyone.
The comparison describes intended packaging; complete tier implementation is the next phase after backend verification.

## Validation completed
15 behavioral scenarios passed:
- Four billing normalization/redirect checks.
- Six SQL integration scenarios executed in an isolated PostgreSQL-compatible PGlite database.
- Five account DOM scenarios passed, including offline resume and conflict recovery.
The SQL integration suite's enclosing test also passes. Core scenarios cover access denial, invite ownership/repetition, row isolation, normalization units, sync revisions, billing tier transitions/retries/stale events, support authorization, and the Founding cap.
JavaScript syntax and TypeScript transpilation checks passed; git diff whitespace check passed.
PGlite fixtures simulate existing Supabase schemas and roles. They do not replace testing against staging Supabase Auth, Storage, Edge Functions, or real Stripe events.
DOM tests are not a visual browser review. The browser download failed, so rendered visual QA remains pending.

## Production change requiring explicit approval
Apply docs/proposed-tier-operations.sql to the existing project, then deploy the matching checkout, portal, and webhook handlers and publish the matching client.
It adds four operational tables, modifies feature definitions/access functions, adds snapshot/subscription metadata, restricts direct snapshot writes, and installs normalized reporting projections.
No existing user or financial records are deleted. Existing APIs that directly upsert snapshots must be updated to the new sync RPC in the same release window.
Rollback is not simply deleting the new schema: preserve invitation, reservation, and billing records. Save the previous function versions and database schema before production rollout.

## Still required before declaring the backend complete
1. Verify the deployed client and complete authenticated staging end-to-end validation.
2. Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the actual SITE_URL securely. The source has no secret keys. Tool access in this session did not expose secure Edge Function secret configuration.
3. Register the Stripe webhook endpoint. The connected live Stripe account currently has zero registered webhook endpoints.
4. Configure billing portal cancellation and tier-change rules, especially Founding price protection. Reconcile Stripe subscription IDs with database records.
5. Verify signup/email confirmation/reset redirects and Resend SMTP; no emails were sent in this work.
6. Establish a verified owner account and assign its owner membership through a controlled server operation; do not elevate user-editable metadata.
7. Complete account export and deletion workflows, private cloud-photo upload/legacy import, terms/privacy/refund versions and consent capture, backup/recovery and monitoring.
8. Complete operational queues, review cadence, and explicit Concierge capacity/intake.
9. Test authenticated signup -> invite -> plan -> logging -> sync -> payment -> entitlement -> cancellation end to end with a Stripe sandbox.
10. Complete the actual Core, Pro, Elite, and Concierge feature implementations and visual QA; do not enable paid enrollment for capabilities that cannot yet be delivered.

This release is a tested backend improvement proposal, not an IPO-ready, audited, or fully launched company backend.
