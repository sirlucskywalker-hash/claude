# PhysiqueOS MVP

Zero-overhead, local-first adaptive fitness coaching app.

## Current MVP
- Deep client onboarding
- Dynamic calorie and macro calculation
- Adaptive weekly review using real progress and adherence
- 7-day meal-plan generation with exact portions and meal macros
- Grocery-list generation and budget estimate
- Meal swaps
- Workout generation by experience, schedule, equipment and limitations
- Workout logging
- Weight, body-measurement, steps, water, sleep, calorie and adherence tracking
- Progress charts
- Rules-based coaching guidance
- Local browser storage with backup/export/import
- PWA/offline-ready architecture

## Architecture
This first release is intentionally static and local-first so there is no required monthly hosting/database bill. The next milestone is free-tier authentication/database sync and a coach dashboard.

## Deployment
GitHub Pages deployment is configured through `.github/workflows/pages.yml` and publishes automatically from `main`.

## Important
PhysiqueOS is educational fitness software, not medical care. Energy-expenditure and macro targets are estimates that should become more individualized as longitudinal data accumulates. The app does not diagnose or treat injuries.

## Prepared backend release (not deployed)
See CHANGE_REVIEW.md for the exact scope, validation, production approval request, and outstanding launch requirements. The proposed SQL targets the existing Supabase database; it is not a complete fresh-install migration chain.

Run the isolated checks with `npm ci` and `npm test`. They do not connect to Supabase or Stripe.

Do not publish this frontend without the matching SQL and Edge Functions. Direct snapshot writes were replaced by the `sync_app_state` RPC. All paid enrollment remains closed until an end-to-end sandbox purchase and cancellation are verified.
