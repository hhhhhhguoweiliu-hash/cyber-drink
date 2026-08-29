# PROJECT BOARD — cyber-drink

## MODE
`AUDIT_ONLY_UNTIL_NEXT_MILESTONE`

## STATE
- Existing native WeChat mini-program codebase with app/pages/assets/utils/project config.
- Repository currently lacks a root README, so its current implemented scope and release status should be reconstructed from code before further product work.

## QUEUE
### CYB-P0-001 — Repository inventory + current-state README
- status: READY
- goal: Inspect app.json/pages/utils/assets/config and create an accurate README describing implemented features, project structure, run requirements, known limitations, and evidence-based current state. Do not invent unimplemented features.

### CYB-P0-002 — Static/syntax/config smoke audit
- status: READY
- goal: Run available non-account checks for JSON/JS/WXML/WXSS/config integrity and identify deterministic errors; fix only low-risk clear bugs.

### CYB-P1-001 — Package/assets risk audit
- status: READY
- goal: Check obvious package-size/unused-large-asset/config risks without deleting assets unless clearly unreachable and safe; prefer a report for uncertain items.

### CYB-P1-002 — Testability/maintenance plan
- status: READY
- goal: Identify which core behaviors can be protected by lightweight automated checks without changing product behavior.

## IDEA INBOX
New drinking/game/social/face/audio/product features stay here until a future milestone is explicitly set.

## BLOCKED
- Product roadmap / next release goal is not currently defined.
- Real WeChat developer-tool upload, AppID, privacy, submission and publishing require user/account action.

## LAST CHECKPOINT
ChatGPT PM initialized audit-only Night Shift mode on 2026-08-30.