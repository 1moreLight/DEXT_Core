# V3-P3-001 Room contract implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. User authorized continuous implementation through the complete v3 route and final combined acceptance.

**Goal:** Native version=3 Room manifests install as content-verified snapshots and bind the real spawned Player.
**Architecture:** A pure Rust contract module owns authoring validation and transactional installation. Core independently verifies the same bounded installation snapshot and declared resource hashes before granting its existing session gateway. Native v3 JSON remains the authored/runtime format; the old session overlay remains historical development support until the replacement renderer is ready.
**Tech Stack:** Rust/serde_json/sha2, C# System.Text.Json/SHA256, JSON Schema, existing Tauri/Core/Player transport.
**Spec:** dev_docs/V3_PLAN.md §3–§7; dev_docs/V3_DELIVERY.md.

## Global Constraints

- Stable Room UUID, stable Desk/button/component IDs; rename/reorder never substitute array indexes for identity.
- Only local packaged HTML/CSS/JS and image/video/GIF; no URL wallpaper or private launch paths in shared manifests.
- Author scripts remain untrusted; installation integrity never substitutes for runtime sandbox and trusted input.
- No user-data migration/deletion; final user acceptance before master merge.

## Review Focus

- Case-insensitive resource duplicates, reparse parents and alternate data streams must not escape the installation.
- Changed bytes under a valid manifest must invalidate content identity.
- Failed copy/revalidation must preserve the existing installed snapshot.
- Missing/duplicate IDs or stale references must reject rather than bind another object.
- Shared manifests must reject personal paths/credentials and unknown capabilities.

### Task 1: Native manifest validation

**Files:** Create tauri-ui/src-tauri/src/room_v3.rs, tests/room-v3-contract/Cargo.toml, tests/room-v3-contract/src/lib.rs, room-v3.schema.json, dev_docs/ROOM_V3.md and v3 fixtures.
**Interfaces:** `validate_manifest(&Value) -> Result<Manifest,String>`; `Manifest { room_id, desk_ids, start_desk_id, resource_paths }` derives only from validated version3 JSON.

- [ ] Add failing contract tests for minimal two Desk manifests with/without shared HTML, duplicates, missing defaultDesk, undeclared entry, unsafe paths, unknown action/capability and personal target rejection. Run `cargo test --manifest-path tests/room-v3-contract/Cargo.toml`; expected failure until implementation exists.
- [ ] Implement native format: version3/apiVersion1/id/name/startDesk/desks/resources; optional roomScene/start/idle/transition/components/buttons/dockComponentId. Content refs use `{type,src}`. Buttons use stable IDs and portable actions; private binding values live outside the authored manifest.
- [ ] Run tests, schema consistency fixtures and rustfmt on the new module, then commit named files.

### Task 2: Transactional installation and verification

**Files:** room_v3.rs and contract tests; add installed manifest fixture.
**Interfaces:** `install(source:&Path,destination:&Path)->Result<Installation,String>`; `verify_installation(directory:&Path)->Result<Installation,String>`; Installation uses formatVersion1, native manifest SHA256 and sorted `{path,sha256,size}` resource records.

- [ ] Test missing resources, links/reparse parents, same source/destination, tampered bytes, undeclared files and rollback; run and observe RED.
- [ ] Build sibling staging, copy declared resources with checked canonical ancestry, revalidate staged contents, write installation.json; atomic directory swap with retained rollback on failure. Bound manifest/resource counts and bytes.
- [ ] Verify every declared byte and exact inventory; repeat install and verification, then commit.

### Task 3: Core admission and product apply path

**Files:** InstalledRoomSessionAuthority.cs, new RoomV3Installation.cs, protocol tests, lib.rs apply/validation routes and real v3 probe fixture.
**Interfaces:** native installation verifier produces existing `VerifiedRoomInstallation`, stamped from canonical directory and verified snapshot digest; Rust apply consumes the installation API.

- [ ] Add shared fixture C#/Rust tests for matching inventory, altered manifest/content and wrong Player; run and observe RED.
- [ ] Core independent bounded verification, native version3 branch in Rust validation/apply, run full protocol and relevant Rust tests.
- [ ] Build Core/ReleasePlayer then start same-worktree runtime; apply native v3 sample after native renderer support is committed in the next runtime package. Until then explicitly retain this evidence as pending, not successful.
- [ ] Commit implementation, record exact checks and leave pending real integration gate in ledger; proceed to dependent package per continuous goal.

## Ledger

Keep task results and decisions in dev_docs/implementation/V3-P3-001-ledger.md. This durable ledger is used instead of discarded Bash scratch so subsequent worktrees and goal turns retain the complete evidence. This is an execution-artifact location ruling, not a change to product scope.
