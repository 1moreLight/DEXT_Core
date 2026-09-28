# V3-CORE-004 Storage Fault Containment Plan

**Goal:** Return structured storage failure results without corrupting the authoritative Room session or cutting off valid observers.

**Architecture:** The kernel already persists before publishing committed state. The protocol gateway maps only expected checkpoint `IOException` and `UnauthorizedAccessException` to `StorageUnavailable`; program errors still surface normally. Failed Start/Restore/Complete/SetOperable/Stop keep the existing binding and observers, while a retry after storage recovery proceeds through the usual kernel path.

**Scope:** In-process v3 Core gateway and deterministic faulting store. No file format migration, backup/sync, installer authority, production RPC or v2 change.

## Task 1: Failing regressions

- [x] Inject read/write/clear faults and assert structured failures for every affected command.
- [x] Assert old snapshot and observer stream remain valid; after fault removal the command succeeds.
- [x] Confirm the new tests fail against the current gateway (missing status at compile time).

## Task 2: Protocol containment

- [x] Add `StorageUnavailable` and catch only expected persistence exceptions at affected gateway boundaries.
- [x] Run protocol and kernel harnesses (27/27, 10/10); add a user-readable fault/retry demo and commit named files.

## Task 3: Running Core proof

- [x] Build, start and verify this worktree's Core, Player, Configurator and closed gateway log.
- [x] Update acceptance/TODO/ROADMAP and commit the runtime evidence step.
