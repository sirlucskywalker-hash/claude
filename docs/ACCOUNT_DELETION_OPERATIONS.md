# Account deletion operations

## Implemented workflow

Members can request deletion and check its status without a paid membership. They can withdraw their own pending request. Once owner review starts, changes require support so a withdrawal cannot race an operator's work.

The privately verified PhysiqueOS owner can begin or refresh a review in the owner dashboard, including requests from inactive members. A review lists recorded non-terminal subscriptions, photo metadata and actual files in the user's private photo folder. It records one audit event and in-app notification per transition. No review operation cancels billing, revokes sessions, deletes files, erases an account or marks erasure complete. The subscription list is a local record, not proof of Stripe's current state.

Owner accounts are excluded from this workflow until ownership transfer is separately reviewed. Ordinary admins and coaches cannot start reviews. Browser roles cannot directly edit request status. Pending-request withdrawal and review use the same per-user transaction lock as request creation; withdrawn requests cannot be reviewed.

## Operator erasure checklist — still required before launch

Use authenticated administration with the exact request and account UUID. Never put credentials or wellness records in chat, GitHub or public logs. Do not run a blanket DELETE or manipulate Storage's metadata tables directly.

1. Confirm the signed-in requester and UUID. Check that the request is still `in_progress` immediately before irreversible work. Resolve support messages or identity uncertainty first.
2. Review actual Stripe subscriptions and invoices for every mapped customer. Resolve cancellation, outstanding charges and required financial retention under the approved billing policy. A request does not itself stop billing; a period-end cancellation may still leave an active subscription. Record the provider outcome without copying card information.
3. Decide which records must be retained and for how long under the approved privacy/retention policy. Review foreign keys and triggers before erasure. Deletion requests reference Auth users with cascading deletion, so a request row is not a durable post-erasure receipt. Keep the minimum permitted audit receipt outside cascaded user records; exclude wellness data.
4. Stop marketing and lifecycle sending for the account, revoke active sessions and block new sessions. Account deletion alone does not instantly revoke already-issued access tokens. Confirm that the chosen procedure prevents stale-session writes during erasure; this has not been automated or verified.
5. Enumerate and remove the user's files through the Storage API, including orphan files in the exact UUID folder, then verify the folder is empty. Deleting an Auth user does not remove Storage files automatically. The review counts help identify mismatches but do not constitute cleanup.
6. Erase approved database and Auth records using the operator procedure, with a tested retention and backup policy. Do not delete the privately bootstrapped owner before transferring ownership. Confirm foreign-key restrictions and rollback/recovery handling with a disposable staging account first.
7. Verify account/session denial, no remaining wellness records/files, and required retained records only. Deliver a confirmation through the approved support channel. Address backups and provider-side copies according to the approved retention policy.

This release supplies request review and withdrawal, not an automated erasure implementation or a verified legal retention policy. Paid launch remains blocked until a disposable account passes the complete operator procedure and the other launch gates.
