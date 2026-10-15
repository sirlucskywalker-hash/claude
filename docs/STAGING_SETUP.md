# Isolated staging setup

Production remains `oyrtpvtzaoftinqoossn` at https://physiqueos.pages.dev. The owner authorized using Lucas Hill's Org for staging, conditional on no additional spending. The organization is on Free and only the production project was listed on October 15, 2026. The connector's `get_cost` operation returned unavailable, so no staging project has been created and no cost confirmation was fabricated.

## Provisioning gate

In Supabase, select Lucas Hill's Org and create `PhysiqueOS Staging` in US East only if the project creation screen explicitly shows $0/month and requires no paid upgrade. Otherwise stop. Do not choose a paid preview branch. Keep the database password private. After creation, record the actual project reference; never guess it or reuse production credentials.

Reconcile schema and required baseline objects from the existing production database before applying migrations. Some original deployment objects predate the tracked migration fixture; do not blindly apply every SQL file or copy customer data, production provider secrets, invite tokens, sessions, or audit records into staging. Seed synthetic users and a separately verified staging owner deliberately. Disable email worker/retention jobs, premium AI and public enrollment during setup.

## Separate Pages project

Create a separate Git-connected Cloudflare Pages project for staging using the same repository and `main` branch, build command `npm run build:pages`, output `dist-pages`, Node 22. Inspect for an existing staging project first. Set these browser-safe build variables only:

```
PHYSIQUEOS_BUILD_ENV=staging
PHYSIQUEOS_STAGING_SUPABASE_URL=https://ACTUAL_STAGING_REF.supabase.co
PHYSIQUEOS_STAGING_SUPABASE_KEY=ACTUAL_STAGING_PUBLISHABLE_KEY
```

The builder rejects a production backend or secret API key in staging. It rewrites all three clients and the confirmation-link origin validator in the generated artifact only. It marks the UI as staging and adds noindex directives. These directives are not authentication or access controls. Production builds reject staging overrides and continue to use the existing production project.

Configure staging Auth Site URL, exact redirects and server-only `SITE_URL` using the actual staging Pages origin. Store test Stripe runtime credentials and webhook signing secret only in staging Supabase. Use the already-created IDs in `STRIPE_TEST_CATALOG.json`, never live price IDs. Configure and validate signed webhooks and checkout authorization before giving a synthetic tester access. The staging frontend must not be published until its separate backend is provisioned and verified.

## Verification

Confirm production and staging clients point to different project references; production data never appears in staging. Run the full auth, beta claim, sync, photos, account export and role isolation tests before the test-payment lifecycle. Provider-side catalog creation alone does not pass the app checkout, webhook or entitlement gates.
