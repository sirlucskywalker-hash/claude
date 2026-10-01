# Lifecycle and billing operations

## Account and email flow
Email verification queues a welcome notification and transactional email. Authoritative subscription changes queue account/billing notices. The queue survives failures and uses one deterministic provider idempotency key per event. Do not retry ambiguous delivery manually after the provider idempotency window; the worker stops retries within 23 hours of first attempt. Inspect failed jobs and signed delivery events instead.

`process-lifecycle-emails` uses a dedicated private worker token, Resend API key, verified sender, and production Site URL. Without them it returns 503 and leaves jobs queued. Up to five jobs are claimed atomically with leases. Transient network/429/5xx failures retry with backoff; validation/auth failures require operator repair. Suppressed or unverified accounts are not sent email. The recipient and message content are frozen for retries; an account email change suppresses the old-address job.

`resend-webhook` verifies Svix signatures over the original request body before updating delivery state or suppressions. Complaints and bounces suppress future sending. Duplicate event IDs do not repeat writes. Out-of-order delivered events cannot override a bounce/complaint status. Marketing email and win-back campaigns are not active. Optional re-engagement currently uses in-app notifications only.

Configure a five-minute server schedule to POST to the worker, with `x-worker-token` resolved from Vault, never embedded in source or public browser configuration. Do not publish worker/API/webhook secrets. Confirm a test welcome is actually delivered before enabling general sending.

## Billing changes
Configure the portal through the operator script using current environment price IDs. It offers Core, Pro and Elite monthly/annual prices for switching; Concierge requires staff intake and Founding is never offered as a switch-in plan. Upgrades calculate and invoice prorations immediately. Lower-price changes and interval shortening are scheduled at the paid period end. Cancellation is also at period end without automatic prorated refunds. Members see Stripe's confirmation before accepting the change. The server checks the portal configuration policy before creating a customer session.

Changing away from Founding loses its continuously-active locked-rate promise; the app explains this. Test annual/monthly transitions, payment authentication/failure, scheduled-change cancellation and Founding exits in the sandbox. Entitlements derive from authoritative Stripe subscription state, never an optimistic redirect. This build does not promise a no-refund outcome or automatically contest disputes.

## Deletion requests
The owner dashboard displays pending requests. Confirm identity through the signed-in account; review subscriptions, cancel appropriately, resolve any organizational ownership transfer, document retention requirements and export options. Remove storage objects through the Storage API before deleting an Auth user. Review non-cascading invite references and retained financial/audit records. Use the Auth admin deletion API after the approved erasure procedure, verify application data and storage cleanup, and confirm completion to the member. A queued request is not deletion completion and is not App Store account-deletion readiness by itself.

## Owner access
The selected owner address is in a private allowlist. An authenticated RPC reads the verified email from Auth, locks the seed record, assigns the owner membership and an admin-sourced workspace entitlement, and writes an audit event exactly once. No public signup field, browser flag, or invitation can set this allowlist. The role is visible in the account menu as Owner dashboard after signing in.
