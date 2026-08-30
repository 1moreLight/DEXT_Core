#!/usr/bin/env python3
"""Validate Dext Room v1 fixtures against JSON Schema plus topology rules."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "room.schema.json"
FIXTURES = ROOT / "dev_docs" / "fixtures" / "room-v1"


def allowed_switches(desk_count: int) -> set[str]:
    allowed: set[str] = set()
    for index in range(1, desk_count):
        allowed.add(f"{index - 1}>{index}")
        allowed.add(f"{index}>{index - 1}")
    if desk_count > 2:
        last = desk_count - 1
        allowed.add(f"0>{last}")
        allowed.add(f"{last}>0")
    return allowed


def semantic_errors(room: object) -> list[str]:
    if not isinstance(room, dict):
        return ["root must be an object"]
    desks = room.get("desks")
    if not isinstance(desks, list) or not desks:
        return []
    errors: list[str] = []
    start_desk = room.get("startDesk")
    if isinstance(start_desk, int) and not 0 <= start_desk < len(desks):
        errors.append(f"startDesk {start_desk} is outside 0..{len(desks) - 1}")
    switches = room.get("switches")
    if isinstance(switches, dict):
        allowed = allowed_switches(len(desks))
        for key in switches:
            if key not in allowed:
                errors.append(f"switch {key!r} is not an adjacent or wrap direction")
    return errors


def validate_file(validator: Draft202012Validator, path: Path) -> list[str]:
    try:
        room = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [str(error)]
    errors = [error.message for error in validator.iter_errors(room)]
    errors.extend(semantic_errors(room))
    return errors


def main() -> int:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    failed = False

    for path in sorted((FIXTURES / "valid").glob("*.json")):
        errors = validate_file(validator, path)
        if errors:
            failed = True
            print(f"FAIL valid/{path.name}: {'; '.join(errors)}")
        else:
            print(f"PASS valid/{path.name}")

    for path in sorted((FIXTURES / "invalid").glob("*.json")):
        errors = validate_file(validator, path)
        if errors:
            print(f"PASS invalid/{path.name}: {errors[0]}")
        else:
            failed = True
            print(f"FAIL invalid/{path.name}: unexpectedly valid")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
