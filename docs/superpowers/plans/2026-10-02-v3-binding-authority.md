# V3-CORE-006 Binding and authorization implementation plan

> **For agentic workers:** Use superpowers:executing-plans. The user authorized sequential implementation and combined final acceptance; do not add an intermediate approval wait.

**Goal:** Core resolves stable button/icon entries to private targets only after installed-session, declared-capability, personal-grant and host-input checks.
**Architecture:** One bounded atomic Core-owned personal JSON store holds global targets and independent Room overrides. Verified native installations carry a button/consumer catalog. An action authority reuses the session gateway and issues short-lived single-use input tickets solely to the trusted host adapter, never to authored messages.
**Tech Stack:** C#/.NET9, System.Text.Json, existing Core session gateway and AppCatalogService; independent console behavior tests against production sources.
**Spec:** dev_docs/V3_PLAN.md D05/D08/D12/D16 and §6.2; dev_docs/ROOM_V3.md.

## Global Constraints

- Stable Room/Desk/button IDs; personal paths never enter Room files or public action replies.
- Author capability declaration is not a user grant; grant binds the verified installation stamp and consumer.
- Host verification of real mouse/keyboard input is required before issuing a ticket; an authored isTrusted field is never proof.
- Both ordinary icons and authored buttons refer to the same button ID. Dock role does not grant extra privileges.
- No user data fixtures, master merge or intermediate approval. Native SDK/host and UI integration are required before the full route is called ready.

## Review Focus

- Reopen/save failure must preserve readable prior personal data; malformed storage must not silently reset targets.
- Copy/delete Room operations must isolate bindings/skins without copying permissions or deleting global targets.
- A ticket stolen by another consumer, peer, session or changed installation must fail without launching.
- Grants must be reread and revoked immediately; unknown owners/buttons/scopes cannot infer authority.
- Public results and failure details must not reveal target paths, arguments or working directories.

### Task 1: Private personal store

**Files:** Create Core/Dext/RoomPersonalStore.cs and tests/Dext.RoomActions.Tests/{csproj,Program.cs}; use RoomV3Installation native handle helpers.
**Interfaces:** RoomPersonalStore(directory).Read()->RoomPersonalState, Update(Action<RoomPersonalState>), CopyRoom(sourceId,newId), DeleteRoom(id). State contains formatVersion1/revision/global targets and Room button overrides/consumer grants. Targets have id/name/kind/target/arguments/workingDirectory; overrides have action/deskId/targetId/skin; grants contain installationStamp/capabilities.

- [x] Write named tests: reopen target+binding; copy independent override/skin and empty grants; delete Room keeps global target; locked store replacement preserves old bytes; malformed/oversized/reparse store refuses and does not reset. Run `dotnet run --project tests/Dext.RoomActions.Tests -c Release`; expected RED for missing production API.
- [x] Implement bounded 1MiB unique-key JSON state, known fields/enums and stable IDs; detached reads, copy-on-write Update, native retained-root+file handle atomic replacement. Missing file means empty state; unreadable/malformed means explicit error.
- [x] Run all tests and commit named files with ledger/TODO updates.

### Task 2: Catalog and action authority

**Files:** Create Core/Dext/RoomActionCatalog.cs, RoomActionAuthority.cs; modify RoomV3Installation.cs and RoomSessionProtocol.cs; tests/Dext.RoomActions.Tests.
**Interfaces:** VerifiedRoomInstallation.ActionCatalog; gateway.ReadActionContext(connectionId,peer,sessionId,out RoomActionContext)->RoomProtocolStatus; context owns verified installation/current snapshot/view role. RoomActionAuthority(gateway,store,Action<PersonalTarget>,TimeProvider?) exposes ReadButtons, AuthorizeCapability, IssueHostInput and InvokeButton. Replies contain status and safe authored IDs only.

- [x] Add failing behaviors: two button IDs resolve same global target; absent grant/target, forged peer, wrong consumer, stale/closed/revoked session, wrong Desk scope; scripted request has no ticket; ticket is single-use, bound to peer/owner/button/revision, expires and fails after personal data edit; public JSON contains no private path/args/cwd. Expected RED, then implement.
- [x] Native catalog must derive from already verified room bytes, not an additional unverified file read; explicit official/scene/component consumers and Desk assignments.
- [x] Recheck current admission and grants before every action; only binding.launch reaches private launcher; nav goes through gateway; dext.exit returns RequiresConfirmation for later Dext-owned UI. Errors return safe status, not private exception strings.
- [x] Run action tests plus existing protocol46 and kernel suites; commit.

### Task 3: Production service registration and gate recording

**Files:** App.xaml.cs; acceptance/V3-CORE-006-binding-authority.md, ROOM_V3.md, V3_DELIVERY.md, ROADMAP/TODO/ledger.
**Interfaces:** DI registers RoomPersonalStore under Dext local data/v3/personal and RoomActionAuthority using existing AppCatalogService.Launch. The future Player native activation adapter calls IssueHostInput; authored requests can call only InvokeButton with an existing ticket. Configurator personal edits are privileged Core entrypoints, implemented with the native authoring UI package.

- [x] Register the real services. Run all action/protocol/kernel suites and full `scripts/build.ps1` → `scripts/start.ps1`; expected Release Player and matching-worktree Core/pipe/configurator identity.
- [ ] One fresh whole-branch read-only reviewer per executing-plans; fix Important/Critical in one RED→GREEN pass, no repeat review.
- [ ] Commit and keep unmerged. Full item remains not-ready until real native input/SDK/UI evidence in dependent packages; no claim of whole-route80% from unit checks.

## Ledger

dev_docs/implementation/V3-CORE-006-ledger.md stores task briefs/results/rulings durably. Final acceptance covers real two-entry activation, forged/timed input rejection, revoke/restart/copy/delete and public path privacy.
