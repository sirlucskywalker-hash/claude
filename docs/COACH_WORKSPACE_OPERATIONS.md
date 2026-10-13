# Coach workspaces — October 13, 2026

Separate B2B membership model, not an individual-plan upgrade and not PhysiqueOS staff access.

| Tier | Active client ceiling | Included client app |
|---|---:|---|
| Starter | 5 | Core essentials plus workspace plans/messages |
| Growth | 15 | Same included client access |
| Professional | 30 | Same included client access |
| Studio | 60 | Same included client access |
| Scale | 100 | Same included client access |
| Enterprise | Owner-approved custom limit, currently maximum 1,000 | Same included client access |

Prices are unset, paid enrollment is false, and no Stripe products, prices, charges or coach subscriptions were created. Confirm price, included feature scope and service economics before configuring coach billing. Premium AI video is not included. Paid upgrade/proration and renewal downgrade automation are future billing work; the current free-pilot approval rejects any lower limit below occupied capacity rather than deleting clients.

## Current portal

Open coaches.html from the client app's menu/account menu. Use the existing confirmed Supabase account; coach membership does not require an individual paid subscription. A confirmed user can request one workspace, initially pending. The verified PhysiqueOS owner can approve a free pilot of 1–90 days and choose an exact tier limit (or Enterprise custom capacity). Customer coaches cannot self-activate, increase limits, grant staff roles or access the owner's dashboard.

Coach tools: roster/search, email-bound invitations and revocation, active-client shared progress, reusable written training/nutrition templates, per-client written instructions, private or member-visible workspace notes, and bounded messages. Written assignments are displayed in the portal; they do not automatically replace native workout/macro programs. Native structured plan editing, photo sharing, assistant-coach teams, Stripe coach billing, advanced reports and premium AI allowances are not marked implemented.

## Capacity, enrollment and consent

An accepted active client consumes one seat. Each live pending invitation reserves one seat for seven days, preventing oversubscription before claims. Creating/claiming/revoking invitations, archiving and changing pilot limits lock the workspace row transactionally. A partial unique index permits only one active customer-coach workspace per client. Claimed tokens are bound to a confirmed matching email, single use and retry-safe. Only token hashes persist server-side; token hashes are omitted from owner/account exports and invite lists.

Clients preview the workspace/coach name before consenting to coach-sharing-v1. Server consent records contain workspace scope; accepted clients gain Core access dynamically while their seat and pilot are active. Existing Stripe/admin/beta access takes precedence and is not modified. Joining does not grant another coach app-wide staff permissions. Coach data access is through a narrow consented RPC projection: relevant fitness profile, written baseline, recent check-ins and workout history. Global support, billing, other staff notes, private photo gallery and unrelated app state are excluded. Coach reads are audited.

Archiving/voluntary leaving revokes live sharing and sponsored access immediately at the server and frees the seat. Workspace records and independent individual entitlements remain. Archived records can be viewed by their authorized parties, but new assignments/messages and live progress reads require an active seat and membership. Rejoining requires a new invitation and fresh consent. Pilot expiry/suspension ends sponsored access and live sharing without changing independent billing. Client apps must refresh access after membership changes; offline device records are not erased automatically.

## Security and operations

Six new tables use RLS. Browser writes are RPC-only; private templates/notes and each client's conversations are scoped. Customer workspace ownership is stored separately from organizations/memberships, so existing broad organization owner/admin helpers do not authorize these coaches. Owner data explorer and account export include relevant workspace records with token hashes removed. Sign-out/account changes clear portal data, and async reads check identity generations.

No marketing or sensitive coaching email is sent. Joining/archiving produces controlled in-app account notifications. Coach message notifications/email automation are not implemented by this release. Program instructions never provide medical clearance or override clinical restrictions; coaches remain responsible for qualifications and individualized review. Pilot review is not a guarantee of clinical fitness-program quality.

Before broader enrollment: actual coach/client signup and invite testing, final hosting/Auth callbacks, approved coach terms and data-processing responsibilities, jurisdiction-specific health-data privacy review, retention/erasure procedures for business owners and clients, real Stripe sandbox lifecycle and cancellation tests, physical mobile testing and monitoring. Existing public paid launch gates remain closed.

## Account deletion updates

Include coach_workspace_clients, coach_workspace_content, coach_workspace_messages and invitation/consent/audit records in export and erasure review. Deleting a coach owner cascades their workspace and client links, ending sponsorship; assess business continuity and notify affected clients before executing erasure. Deleting a client cascades their workspace seat/content/conversation but must still account for applicable lawful retention and backups. Do not label deletion complete merely because a request exists. Do not cancel independent subscriptions implicitly.
