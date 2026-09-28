# V3-CORE-002 Core Session Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned, admission-controlled in-process entrance to the Room/Desk kernel and prove it with simulated clients.

**Architecture:** A gateway owns short-lived connections bound to verified transport peer, role, installed Room identity, installation stamp and Core session. An injected admission authority supplies trusted installation data; the production registration denies admission until real P2/P3 adapters exist.

**Tech Stack:** C#/.NET 9, the existing `RoomSessionKernel`, the source-linked console test style under `tests/`, Dext DI and PowerShell build/start scripts.

**Spec:** `docs/superpowers/specs/2026-09-28-v3-session-protocol-design.md`

## Global Constraints

- Do not modify the v2 wallpaper session or make a real Player/Configurator RPC contract in this package.
- Never accept Desk IDs, role, or installation validity solely from a client declaration.
- Reject a connection or command without exposing an authoritative snapshot when authentication or installation verification fails.
- `Coordinator` controls start/restore/operability/stop; Desktop and Dock request navigation; only Desktop completes an animation.
- Use named-file staging and commit at every major step. C# changes require `scripts/build.ps1` before `scripts/start.ps1`.

## Review Focus

- A stolen connection ID sent from another peer must not authorize a command.
- A previously authorized installation removed or changed after connection must invalidate its lease.
- Reconnecting after a missed transition must return the latest full snapshot and revision.
- A view connected to an old Room/session must not mutate a newly started Room.
- A denied connection must not reveal whether an installed Room or active session exists.

---

### Task 1: Admission and version gate

**Files:** Create `lively-core-separation/src/Lively/Lively/Core/Dext/RoomSessionProtocol.cs`; create `tests/Dext.RoomSession.ProtocolTests/{Dext.RoomSession.ProtocolTests.csproj,Program.cs}`.

**Interfaces:** `RoomSessionHello(int ProtocolVersion, RoomClientRole Role, string RoomId)`, `RoomSessionPeer(string TransportId)`, `VerifiedRoomInstallation(RoomId, InstallationStamp, DeskIds, StartDeskId)`, `IRoomSessionAdmissionAuthority.Admit(peer, hello)`, `RoomSessionProtocolGateway.Open(peer, hello)`.

- [x] Write tests for wrong version, denied source, unknown Room and valid coordinator admission; verify denied results have no connection or snapshot.
- [x] Run protocol tests and observe failure.
- [x] Implement verified admission and a closed production authority; validate supplied descriptor and issue an opaque, peer-bound connection.
- [x] Run protocol tests until green, then commit only the files of this task.

### Task 2: Session commands, roles and reconnect

**Files:** Extend the same protocol source and test harness.

**Interfaces:** `Start`, `Restore`, `Read`, `Request`, `Complete`, `SetOperable`, `Stop`, `Close` accept connection ID and trusted peer; use the same structured status/snapshot reply.

- [x] Write tests for trusted Desk IDs, desktop/Dock shared snapshot, last queued input, role restrictions, wrong peer, revocation, stale session and reconnect.
- [x] Run protocol tests and observe failure, including two binding regressions at 12/14.
- [x] Delegate state changes to `RoomSessionKernel` while validating the lease and current admission on every operation.
- [x] Run protocol and existing kernel tests until green (14/14 and 8/8), then commit this behavior step.

### Task 3: Core registration and runtime proof

**Files:** Modify `lively-core-separation/src/Lively/Lively/App.xaml.cs`; update `dev_docs/{TODO.md,acceptance/V3-CORE-002-session-protocol.md}`.

- [x] Register the closed admission authority and gateway in Core DI, and resolve them at startup without opening a v3 session.
- [x] Run both .NET harnesses (14/14, 8/8), `scripts/build.ps1`, then `scripts/start.ps1` from this worktree and verify Core, Player and Configurator paths and startup logs.
- [x] Run `git diff --check`, review the named-file status, and commit the runtime/doc step.
