# Stripe test preparation — October 15, 2026

The existing Apex Training Systems Stripe connection now exposes test mode (`livemode=false`). It initially had no products, prices, portal configurations or webhook endpoints. The eight approved recurring price amounts were created in test mode only. No customer, subscription, payment or charge was created in this preparation step.

## Confirmed integration defect and correction

Stripe rejected the existing portal design because one product contained several prices with the same billing interval. Core, Pro and Elite must use distinct portal product groups. The corrected test configuration was accepted: immediate prorated upgrades, lower-price / shorter-interval changes scheduled for period end, period-end cancellation, cancellation reasons, invoice history and payment-method management. Founding and Concierge are excluded from self-service switch-in options.

The exact reusable test IDs and superseded initial test price IDs are in `STRIPE_TEST_CATALOG.json`. Do not recreate them on continuation. The four superseded shared-product Pro/Elite test prices remain historical test objects and must not be selected. Core, Founding and Concierge test prices use the original test product; Pro and Elite now use separate products. Their lookup keys and product associations are not an authorization mechanism.

The live catalog remains unchanged. Its existing Pro/Elite prices share a product with Core and cannot support the desired portal options. After successful tests, deliberately create separate live Pro/Elite products and replacement prices, update the server catalog atomically and verify them. Do not blindly duplicate prices or archive any price with subscribers.

## Operator script

`node scripts/configure-billing-portal.mjs` defaults to an offline dry run and needs no secret. `--apply-test` or `--apply-live` is required to write. The matching server-only key and six Core/Pro/Elite price variables plus `SITE_URL` are required. Before writing, it retrieves and validates the prices' mode, currency, approved amount, recurrence and product grouping. It rejects the original duplicate-interval layout. Do not run it to duplicate the already-created test portal configuration; reuse its recorded ID.

## Remaining payment gates

- Isolated backend test environment, with synthetic users/data and test-only provider credentials. Only the production Supabase project currently exists. Do not replace production billing identifiers or grant production entitlements to simulate tests.
- Register the Stripe test webhook only after an isolated handler and signing-secret storage are ready; no webhook was registered by this step.
- Test app-authenticated Checkout, completed and failed payment, signed webhook ingestion, event replay/out-of-order handling, entitlements, renewal, proration, scheduled downgrade, portal cancellation and access expiry. Creating a portal configuration does not prove these flows work.
- Add provider secrets through secure administration, never source control or chat. The connected Stripe tool does not install runtime credentials into Supabase.
- Keep paid enrollment closed. Do not claim email receipt delivery, tax setup, refunds/disputes handling or full launch readiness based on test catalog configuration.
