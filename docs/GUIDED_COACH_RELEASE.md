# Guided coaching release

October 1, 2026 UTC (September 30 in America/New_York).

## Implemented

- Coach With Me focused session, existing-program snapshot, readiness briefing and configurable time budget.
- Planned session or first-three-movement option; current safety/recovery restrictions retained.
- Complete working sets, optional RIR, per-set persistence and interrupted-session resume.
- Timestamp-based rest, pause/resume, extend, completion vibration while active and reconstruction after suspension.
- Undo, skip remaining movement sets, substitutes before the first set and exact barbell plate helper.
- Session review with effort, discomfort and notes; partial sessions; stable log ID; duplicate completion protection.
- Dashboard resume/next-action card, personal daily commitment and coaching style preferences.
- Contextual deterministic next-set responses use actual session data when adaptive coaching is entitled.
- Account state replacement closes stale guided screens; history loads are not automatically copied across mismatched units.
- Service-worker cache activation retains the current cache and removes only previous PhysiqueOS caches.

## Verification

The original 15 behavioral scenarios plus 11 new coaching scenarios pass (26 scenarios, with a separate enclosing database test also passing). New integration tests load the actual index, data, app and coaching scripts in a browser-like DOM. Tests cover persisted sessions, restrictions, rest reconstruction, undo, input validation, stable completion, state replacement and standard/guided log coordination.

`tests/coaching-preview.html` is a clearly labeled visual component fixture using sample data and no account/cloud writes. It is not an end-to-end authenticated account, a substitute for production workout testing or an entitlement bypass.

## Delivery limitations and next requirements

The expanded product blueprint remains much larger than this release. Coaching here is deterministic guidance, not a connected conversational AI service. Timer countdown reconstructs correctly after backgrounding, but web background audio/vibration delivery is not guaranteed. Native lock-screen/Watch controls, continuous voice, wearables and validated camera coaching remain unimplemented. Concierge human staffing, assignment, scheduling and response promises require an operational service. Payments remain closed pending the previously identified private configuration and end-to-end verification.

Supersets, circuits, warm-up-set logging, intelligent priority-based session shortening, private cloud photos, food scanning/imports, full daily planning, tier-specific economics and specialist programs remain subsequent implementation work. Current substitutions match muscle groups; they do not certify identical biomechanics or preserve a verified movement pattern. The member must check suitability and available equipment. No automatic load changes occur in this release.

No prices, enrollment flags, billing secrets or human-service commitments changed.
