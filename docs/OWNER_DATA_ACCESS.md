# Owner data access

Sign in to the app as the verified owner (`sirlucskywalker@gmail.com`), open the account menu, and choose **Owner dashboard**. The **Owner data explorer** covers every current public business table, sanitized authentication account status, and lifecycle email jobs/delivery/suppression records. Accounts without an invite claim, inactive memberships, and internal staff notes remain visible here. The standard roster and assignment controls retain their existing organization restrictions.

The explorer reads 100 records at a time. Use Previous/Next and Export this page to download JSON. The export identifies its section, offset and export time. Pagination is not a database snapshot: avoid collecting pages while records change. Photo metadata is exported separately from images; View private photo generates a link expiring after five minutes. Only exact registered user-folder paths in the private progress-photos bucket are eligible. Files uploaded without metadata remain an operator storage-reconciliation task.

Project-wide access requires a confirmed authenticated account, a claimed private owner-bootstrap entry, and an active owner membership in the active PhysiqueOS organization. An owner of another organization, an administrator, a coach, or a client cannot invoke these reads. Every data page read creates an audit record. Owner access does not create browser write/delete privileges. Revocation of the active owner membership immediately prevents new reads and signed URLs; existing five-minute links expire normally.

Authentication passwords/hashes, recovery tokens, provider secrets, email worker lease tokens, and invitation token hashes are excluded. Complete Stripe financial reporting remains in the owner's Stripe dashboard; this explorer exposes records actually synchronized into PhysiqueOS, not unverified provider data. Device-only data appears after successful cloud sync. Email job status is not proof of inbox delivery.

The migration also removes legacy TRUNCATE, REFERENCES and TRIGGER grants from browser roles. TRUNCATE bypasses row-level security. Normal row policies and service-role operations remain in force.

New business tables must be added explicitly to the owner RPC allowlist and the explorer section list. This project-wide owner model assumes this Supabase project remains dedicated to PhysiqueOS. A future shared-project tenant design requires a separate review before introducing another business.

Verification: behavioral tests cover unclaimed/inactive accounts, sensitive-field exclusions, client/coach/foreign-owner denial, owner revocation, pagination, auditing, registered private-photo paths, removal of bulk destructive grants, and owner/admin UI separation. Real signed-in owner browser and inbox/payment/mobile launch gates remain separate.
