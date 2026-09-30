# Backend launch checklist

## Provision
- [ ] Create/connect Supabase project
- [ ] Apply migrations
- [ ] Create private storage bucket: progress-photos
- [ ] Configure Auth redirect URLs for production and localhost
- [ ] Enable email verification
- [ ] Configure SMTP/Resend when ready
- [ ] Create/connect Stripe account
- [ ] Create monthly and annual products/prices
- [ ] Set Stripe secrets in Supabase Edge Function secrets
- [ ] Deploy checkout, portal, and webhook functions
- [ ] Register Stripe webhook endpoint
- [ ] Make one test purchase and one test cancellation
- [ ] Confirm webhook idempotency and entitlement changes

## Product integration
- [ ] Add sign up / sign in / sign out
- [ ] Require app_access entitlement for paid features
- [ ] Allow explicit beta entitlement
- [ ] Sync onboarding/profile to PostgreSQL
- [ ] Sync check-ins and measurements
- [ ] Add offline queue/retry
- [ ] Add one-time localStorage import
- [ ] Add progress photo upload via private storage
- [ ] Add coach/admin dashboard
- [ ] Add invitation links and attribution
- [ ] Add account deletion/data export

## Operations
- [ ] Terms of Service + Privacy Policy versions recorded in consent_events
- [ ] Support email and internal escalation process
- [ ] Error monitoring
- [ ] Uptime checks
- [ ] Database backup policy
- [ ] Access review / least privilege
- [ ] Incident response document
- [ ] Financial reconciliation between Stripe and internal subscription table
- [ ] Monthly KPI dashboard: MRR, churn, trial conversion, active users, adherence, retention

## Before larger scale
- [ ] Separate dev/staging/prod environments
- [ ] Automated migration tests
- [ ] CI checks before production deployment
- [ ] Formal retention/deletion policy
- [ ] Vendor/security inventory
- [ ] SOC 2 readiness assessment if enterprise sales require it
- [ ] Legal/privacy review for health-related consumer data
