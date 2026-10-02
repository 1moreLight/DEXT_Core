# Execution ledger — plan: docs/superpowers/plans/2026-10-02-v3-binding-authority.md

- BASE: 3a9e250.
- Ruling: continue sequential isolated dependency packages and combined acceptance per explicit user goal; no interim plan confirmation — cost if wrong: review final data/UI rules together before merging.
- Ruling: durable ledger replaces Bash skill scratch artifacts — cost: tracked documentation overhead, no runtime change.
- Pre-flight: Task1 private snapshot feeds Task2 actions; Task2 verified catalog comes from P3 native validation and feeds Task3 production registration. Public replies never serialize private snapshot types. No interface conflicts.
- Ruling: read-only declared capabilities and action grants are consumer+installation specific; copy Room copies bindings/skins but not grants — cost if wrong: copied Room asks for fresh consent. Supports D05 privacy and independent identity.
- Ruling: issue input tickets only from a trusted Core host adapter after native input verification; no IPC method may expose issuance to authored JSON — cost if wrong: actual native adapter gate remains mandatory and is not substituted by unit tests.
- CodeGraph: worktree contains an uninitialized .codegraph placeholder; CLI explicitly reports no index and directs usual tools. No indexing run.

- Task1 complete: tests first compiled RED for absent store; real native publish failures then reproduced (6/9) due unterminated FILE_RENAME_INFO path. Added NUL storage while length excludes NUL; private store9/9 and existing protocol46/46 passed. Detached read, copy/skin isolation, no copied grants, global target preservation, locked replacement, malformed/duplicate/oversized/reparse refusal verified. Core sole writer uses existing single-instance identity; this store is not a cross-process editing API.
- Ruling: retain failed .personal-*.tmp snapshots inside the private data root rather than delete a mutable name after closing its handle — mandatory release recovery/cleanup handles these — cost if wrong: failed saves retain bounded per-attempt data until cleanup gate is added.
- Reference: https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_rename_info (FileName is NUL-terminated; FileNameLength counts bytes excluding terminator).
