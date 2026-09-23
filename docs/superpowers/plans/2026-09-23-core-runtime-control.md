# CORE-006 Configurator Core Runtime Control Implementation Plan

> 实施记录：按单工作包步骤执行；勾选项表示本轮已自测，人工验收以独立验收卡为准。

**Goal:** Let the configurator start and gracefully exit its own Dext Core from the connection indicator.

**Architecture:** Rust owns process path selection, spawn, RPC shutdown and readiness polling. React owns the short-lived busy state and renders one context-sensitive Core action beside the polled identity. Existing Core startup restores saved wallpaper layout.

**Tech Stack:** Tauri 2 / Rust / Tokio, React / TypeScript / Vitest, existing Dext named-pipe RPC.

**Spec:** `docs/superpowers/specs/2026-09-23-core-runtime-control-design.md`

## Global Constraints

- Work only in `feat/CORE-006-core-runtime-control` and commit only named files from this package.
- Do not accept executable paths or PIDs from the webview.
- Do not change Room files, wallpaper layout or the existing wallpaper pause/stop semantics.
- An occupied Pipe with an unverified identity cannot be stopped or replaced.
- Do not merge into master before user acceptance.

## Review Focus

- Core missing from this worktree: Start reports the missing path and leaves the configurator usable.
- Another Dext worktree owns the Pipe: Start refuses to spawn and Exit refuses to address it.
- Core is running without WorkerW: status says desktop is not ready and apply remains disabled.
- Shutdown may close the Pipe before returning RPC trailers: Exit verifies the original process has ended.
- Repeated clicks during startup or shutdown: only one process operation runs at a time.

---

### Task 1: Rust Core lifecycle boundary

**Files:** Create `tauri-ui/src-tauri/src/core_runtime.rs`; modify `tauri-ui/src-tauri/src/lib.rs`, `tauri-ui/src-tauri/src/grpc.rs`.

**Interfaces:** `start_core() -> Result<grpc::CoreIdentity, String>` and `exit_core() -> Result<(), String>` are Tauri commands with no webview arguments. `grpc::core_identity()` remains the verified identity read; add a verified shutdown request using existing `CommandsService/ShutDown`.

- [x] Write Rust tests for dev executable path resolution, rejecting a config exe outside its compile-time worktree, missing Core binary, and readiness success only for a matching initialized Core.
- [x] Run focused tests and confirm they fail due to missing behavior.
- [x] Implement path resolution, a single-flight lifecycle lock, guarded spawn, readiness wait, verified RPC shutdown and process-exit wait. Register the two commands in `lib.rs`.
- [x] Run focused tests, then `cargo test --lib` and `cargo check`; inspect failures before continuing.

### Task 2: React status and action

**Files:** Modify `tauri-ui/src/features/runtime/useDextRuntime.ts`, `tauri-ui/src/features/runtime/core-status.ts`, `tauri-ui/src/features/runtime/core-status.test.ts`, `tauri-ui/src/app/AppHeader.tsx`, `tauri-ui/src/App.tsx`.

**Interfaces:** `useDextRuntime` exposes a `refreshCore()` action; `AppHeader` receives the lifecycle busy state and click handler. Backend command names are `start_core` and `exit_core`.

- [x] Write failing Vitest cases for unavailable/ready/uninitialized/rejected/busy states: each has the intended text and only the permitted action.
- [x] Run the focused Vitest file and confirm feature-specific failure.
- [x] Implement header action labels, busy feedback and immediate refresh after Tauri commands. Gate Core-dependent actions on `is_core_initialized`.
- [x] Run focused tests, `npm test`, and `npm run build`; inspect light and dark UI in the real configurator.

### Task 3: Live process validation and delivery

**Files:** Update `dev_docs/TODO.md`, `dev_docs/ROADMAP.md`, `dev_docs/acceptance/CORE-006-core-runtime-control.md`; add only a newly discovered resolved pitfall to `dev_docs/ERRORS.md` and the appropriate chapter.

- [x] Run `scripts/start.ps1` from this worktree and verify absolute Core/configurator paths and Dext Pipe.
- [x] Exit Core through the configurator and verify Core, Player and Watchdog are gone while configurator remains.
- [x] Start Core through the configurator, verify identity and WorkerW readiness, and verify wallpaper layout restores; repeat once.
- [x] Test missing Core binary feedback and recovery; restore the file, run full checks, inspect the diff, stage only named package files, commit, and mark ROADMAP as `待验收`.
- [x] Present the four-step manual acceptance list from the card and stop before master merge.
