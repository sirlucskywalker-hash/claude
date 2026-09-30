# PhysiqueOS Backend Architecture

## Objective
Build the beta on the same foundations needed for a large subscription software company: one source of truth for customers, longitudinal fitness data, billing, permissions, auditability, support, analytics, and future multi-coach organizations.

## Recommended stack
- **Database/Auth/Storage/Realtime:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Billing:** Stripe Checkout + Customer Portal + webhooks
- **Hosting/CDN:** Cloudflare Pages (frontend) when migration is complete
- **Transactional email:** Resend
- **Source control/CI:** GitHub
- **Analytics:** event table first; dedicated warehouse/product analytics later

This keeps beta infrastructure inexpensive while preserving standard PostgreSQL portability.

## Core design principles
1. PostgreSQL is the authoritative business record. Browser localStorage becomes an offline cache, not the source of truth.
2. Every business object belongs to an organization and/or authenticated user.
3. Billing state is derived from verified Stripe webhooks, never from client-side success screens.
4. Row Level Security is enabled on all user-data tables.
5. Admin actions and consent changes are auditable.
6. Schema changes are migrations committed to Git.
7. No secret keys are shipped to the browser.
8. Use immutable external IDs for Stripe/customer mapping.
9. Keep product entitlements separate from plan names so pricing can change without application rewrites.
10. Beta invite attribution is stored from the first click.

## User lifecycle
invite link -> landing page -> account creation -> invite claimed -> profile/onboarding -> beta/paid entitlement -> app usage -> check-ins -> adaptive recommendations -> renewal/cancel/rejoin.

## Backend domains
### Identity and access
organizations, profiles, memberships, invites, consents, admin roles.

### Coaching data
client_profiles, measurements, daily_checkins, progress_photos, meal_plans, training_programs, workout_sessions, coach_notes.

### Billing
billing_customers, subscriptions, entitlements, billing_events.

### Growth / operations
attribution_events, product_events, support metadata, feature_flags, audit_log.

## Roles
- owner: company owner
- admin: operations/support
- coach: can manage assigned clients
- client: owns personal fitness data
- analyst: read-only aggregated/business reporting

## Billing model
Stripe owns payment instruments and financial transaction execution. PhysiqueOS stores Stripe IDs and normalized subscription/entitlement state.

Do not grant access because Checkout redirected to success. Access is granted only after a verified webhook records an active/trialing subscription or an explicit beta entitlement.

## Beta
Beta users should still create accounts. Give beta access through an entitlement row with a time window or permanent beta flag. This means all beta data is immediately usable in the production backend rather than requiring migration later.

## Existing localStorage users
After cloud auth is enabled:
1. User signs in.
2. Client detects legacy local data.
3. User confirms import.
4. Payload is validated and written transactionally.
5. An import receipt is stored to prevent duplicate imports.
6. Browser data remains only as offline cache after successful sync.

## Privacy/security baseline
- RLS on every client-data table.
- Signed URLs for private progress photos.
- Separate service-role secrets server-side only.
- Audit privileged access.
- Record privacy/terms/marketing consent versions.
- Rate-limit auth and payment endpoints at the edge.
- Daily backups/PITR when the business justifies paid database tier.
- Formal incident response, retention schedule, vendor review, SOC 2 program, and legal review before enterprise/regulated claims.

PhysiqueOS should not claim HIPAA, SOC 2, PCI, or other compliance status until the actual operational requirements and audits are completed.

## Scale path
The schema intentionally uses standard PostgreSQL. If usage outgrows the initial managed stack, application services can be split by domain while PostgreSQL remains the transactional core. Analytics events can later stream to a warehouse without redesigning customer records.
