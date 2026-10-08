# PhysiqueOS — Tier Release Contract
Updated: 2026-10-07

## Product policy
Invite-only beta remains free, no credit card, with verified email/account, owner-issued one-time invite, server-side beta entitlement and production cloud storage. Do not open paid enrollment until test-mode checkout, webhook, cancellation, plan-change, failed-payment, and entitlement checks pass. All current plan_catalog.public flags must remain false until the release gate is approved.

## Pricing (USD)
| Tier | Monthly | Annual | Notes |
| --- | ---: | ---: | --- |
| Core | $29 | $290 | Entry-level self-service |
| Founding 100 | $39 | — | Pro-equivalent introductory rate, limited to first 100 **paying** founders; continuous subscription requirement |
| Pro | $59 | $499 | Full adaptive self-service |
| Elite | $119 | $999 | Advanced insights and priority support |
| Concierge | $349 | — | Capacity-limited human oversight |

## Tier matrix — currently authorized backend feature codes
| Feature | Beta | Core | Founding | Pro | Elite | Concierge |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| tracking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| nutrition_targets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| meal_planner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| training_plan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| workout_logging | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| adaptive_coach | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| advanced_meal_swaps | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| progress_photos | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| advanced_adaptation | — | — | ✓ | ✓ | ✓ | ✓ |
| advanced_analytics | — | — | ✓ | ✓ | ✓ | ✓ |
| priority_support | — | — | ✓ | ✓ | ✓ | ✓ |
| concierge_messaging | — | — | — | — | — | ✓ |
| human_review | — | — | — | — | — | ✓ |

**Important:** A backend feature flag does not establish that its user-facing functionality is fully implemented, reliable, staffed, or tested. Do not market unimplemented capabilities as available. The beta is a limited test product.

## Required production acceptance tests
1. Email-confirmed signup without invite: no paid/beta entitlement, no access to member data.
2. Valid beta invite: single-use, expiry and optional email binding enforced, beta entitlement assigned; subsequent logins retain access.
3. Invite signup requiring email verification: pending invite can be claimed after confirmation and login.
4. Signed-in user A cannot read, write, export or delete user B's sensitive records, photos, snapshots, subscriptions or support data.
5. Coach/admin can access only assigned organization clients; ordinary client cannot use owner dashboard.
6. Local device state imports once, cloud sync survives reload, conflicts retain recoverable local backup, no cross-account state leak.
7. Feature matrix checked at the backend for every premium server operation; front-end feature locks alone are not security boundaries.
8. Progress photos: private bucket, owner-only signed object paths, validated types/sizes and delete handling.
9. All Stripe price IDs match the catalog and account; Checkout validates tier and price server-side.
10. Stripe webhook signatures verified; duplicates and out-of-order events handled; cancellation and payment failures change entitlements correctly.
11. Founding 100 slot cap is enforced transactionally; plan switches do not silently preserve an abandoned founding price.
12. Customer Portal upgrades prorate as approved; downgrades/cancellations at period end; tax/refund/dispute policies verified.
13. Email notifications have verified sender domain, delivery logs, suppression/unsubscribe behavior where appropriate, and retries.
14. Support, privacy export and deletion request workflows are tested; operational staff can handle real requests.
15. Automated backup/recovery, monitoring, security review and staged deployment checks are in place before paid launch.

## Delivery phases
- **Phase A: secure beta (now):** authenticated accounts, invites, cloud sync, check-ins, owner dashboard, beta entitlement, photo storage, support and consent.
- **Phase B: paid readiness:** Stripe secrets, verified webhook endpoint, portal configuration, live site URL, end-to-end test-mode and controlled live smoke tests; public enrollment remains closed until signoff.
- **Phase C: Core and Pro:** polished separate UX paths, data model consistency, nutrition/training/adaptive quality, access enforcement and feature parity testing.
- **Phase D: Elite:** advanced analytics and documented priority support capacity; add form/physique analysis only after implementation and evaluation.
- **Phase E: Concierge:** human review workflow, staff workload/capacity limits, service-level expectations, appointment and messaging operations.

## Open external dependencies
- Cloudflare Pages deployment/private GitHub migration and final SITE_URL.
- Production Stripe secret, webhook signing secret, portal configuration and webhook registration; never commit secrets.
- Verified Resend domain and sending credentials.
- Production backup/recovery and privacy/legal policies.
- App Store requires Apple Developer membership later; web/PWA beta can launch independently.

The project is not certified IPO-ready, SOC 2 compliant, HIPAA compliant, or production-billing verified by this document.
