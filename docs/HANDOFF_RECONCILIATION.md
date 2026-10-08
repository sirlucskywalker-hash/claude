# PhysiqueOS handoff reconciliation — October 7, 2026

The supplied Full Build Backend handoff is incorporated as project history. Live systems were inspected before changes. The Lucas Method repository was not modified.

## Verified current state
- Main already contains merged PR #2, PWA icons, isolated password recovery, and a tier release contract. Prior checkout origin checks, server price mapping, entitlement normalization, owner bootstrap, cloud revisions, notifications, email retry/suppression, private photo operations, export and deletion requests already exist; they were preserved.
- Supabase has 12 deployed migrations and five active Edge Functions. The new migration is staff_assignment_and_tenant_isolation.
- The existing Apex Training Systems account is connected in live mode. A sandbox still is not exposed by the connector; no prices or products were recreated and no live charges occurred. Resend still has no sending domains.
- Public paid enrollment remains closed. Cloudflare/private repository migration remains deferred.

## New deployed permission changes
- Owner/admin-only, audited coaching assignment RPC; coaches cannot assign themselves. Assignment requires active coach and client memberships in the same organization. Revocation immediately affects database reads on the next request. No coach receives access automatically.
- Coaches can read only assigned clients. Wellness rows require matching organization membership; a forged organization ID no longer authorizes writes or staff access. Ordinary clients cannot enumerate other members.
- Notes require an assigned client and the signed-in author. Staff-only notes remain hidden from clients.
- Coaching assignments do not grant access to billing records, entitlement administration, consent records or deletion queues. Private photo objects remain owner-only.
- Browser/anonymous telemetry inserts are disabled; existing server invite attribution triggers remain active. Future acquisition telemetry needs a bounded server ingestion path.
- Owner dashboard includes assignment/revocation controls, recent check-ins and notes, with account snapshots under an expandable detail panel.

## Evidence and limits
Behavioral database tests cover member enumeration, forged organizations, assignment authorization, unassigned denial, author spoofing, private notes, billing separation and revocation. Full suite passes 52 scenarios, including two owner-dashboard checks for unauthorized access and safely rendered member data/assignment errors. Live catalog checks confirm assignment RLS enabled, direct browser assignment writes denied, telemetry insert privileges denied and zero anonymously executable public privileged functions.

Security advisor still reports 20 intentionally exposed privileged authenticated operations, four server-only tables with no browser policies, and leaked password protection disabled. This targeted review is not an independent security audit. Guidance: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Remaining release gates
Real authentication/email redirects and account/device flows; connected Stripe sandbox with signed webhook/payment lifecycle tests; verified email sender and worker configuration; approved privacy/terms and signup consent; actual account erasure/retention handling; backups/restore and monitoring; physical iPhone install/offline checks. Native App Store distribution waits for revenue-funded enrollment. Backend flags alone do not certify premium features, human staffing or continuous AI coaching. See TIER_RELEASE_CONTRACT.md and ZERO_COST_LAUNCH_RUNBOOK.md.
