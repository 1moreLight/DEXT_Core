# V3-CORE-003 Session Observation Plan

**Goal:** Deliver connection-bound full snapshot subscriptions for two simulated v3 views.

**Architecture:** The protocol gateway uses the existing kernel subscription stream. Every delivery verifies the stored connection, trusted peer, current installation admission and bound SessionId before exposing a snapshot. The gateway owns subscription handles and disposes them on connection close, admission loss, session replacement and stop. Reconnection uses `Open` to retrieve the current full snapshot.

**Scope:** Core internal gateway and simulated clients only. No production RPC, installer authority, v2 wallpaper changes or D11 lifecycle behavior.

## Task 1: Failing observation regressions

- [ ] Add cases for initial snapshot, monotonically increasing revisions and same sequence in Desktop/Dock.
- [ ] Add cases for wrong peer, close, installation revocation/replacement, new session and failing observer.
- [ ] Confirm the new cases fail against the current gateway.

## Task 2: Gateway subscription lifecycle

- [ ] Add a structured `Subscribe` result with an opaque disposable handle. Reject unauthorized registration without a snapshot.
- [ ] Recheck current admission and session binding on every kernel delivery. Release handles when leases end, without breaking other observers.
- [ ] Run protocol and kernel regressions, demonstrate two views, review diffs and commit named files.

## Task 3: Running Core proof

- [ ] Build with `scripts/build.ps1`, start with `scripts/start.ps1`, verify Core/Player/Configurator paths and gateway log.
- [ ] Record automatic checks and manual steps in the acceptance file; commit the runtime evidence step.
