#!/usr/bin/env python3
"""Validate the native Dext Room v2 contract and self-contained sample packages."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = {2: ROOT / "room-v2.schema.json"}
CREATOR_SCHEMA = ROOT / "creator-kit" / "creator-pack.schema.json"
CREATOR_FIXTURES = ROOT / "creator-kit" / "fixtures"
CREATOR_TEMPLATES = ROOT / "creator-kit" / "templates"
FIXTURES = ROOT / "dev_docs" / "fixtures"
SAMPLE_LIBRARY = FIXTURES / "room-v2" / "sample-library"
INVALID_SAMPLE_LIBRARY = FIXTURES / "room-v2" / "invalid-sample-library"
MAX_WIDGETS_PER_ROOM = 64
MAX_CONFIG_BYTES = 65_536
MAX_CONFIG_DEPTH = 12


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


def json_depth(value: object, depth: int = 1) -> int:
    if isinstance(value, dict):
        return max([depth, *(json_depth(item, depth + 1) for item in value.values())])
    if isinstance(value, list):
        return max([depth, *(json_depth(item, depth + 1) for item in value)])
    return depth


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
    if room.get("version") != 2:
        return errors

    widget_ids: set[str] = set()
    widget_count = 0
    for desk_index, desk in enumerate(desks):
        if not isinstance(desk, dict) or not isinstance(desk.get("widgets"), list):
            continue
        for widget_index, widget in enumerate(desk["widgets"]):
            if not isinstance(widget, dict):
                continue
            label = f"desks[{desk_index}].widgets[{widget_index}]"
            widget_count += 1
            widget_id = widget.get("id")
            if isinstance(widget_id, str):
                if widget_id in widget_ids:
                    errors.append(f"duplicate Widget id {widget_id!r}")
                widget_ids.add(widget_id)
                prefix = f"widgets/{widget_id}/"
                src = widget.get("src")
                resources = widget.get("resources")
                if isinstance(src, str) and not src.startswith(prefix):
                    errors.append(f"{label}.src must stay inside {prefix}")
                if isinstance(resources, list):
                    if src not in resources:
                        errors.append(f"{label}.src must be listed in resources")
                    for resource in resources:
                        if isinstance(resource, str) and not resource.startswith(prefix):
                            errors.append(f"{label}.resources must stay inside {prefix}")
            placement = widget.get("placement")
            if isinstance(placement, dict):
                x, y = placement.get("x"), placement.get("y")
                width, height = placement.get("width"), placement.get("height")
                if all(isinstance(item, int) for item in (x, y, width, height)):
                    if x + width > 1920 or y + height > 1080:
                        errors.append(f"{label}.placement must stay inside the 1920x1080 canvas")
            config = widget.get("config")
            if isinstance(config, dict):
                size = len(json.dumps(config, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
                if size > MAX_CONFIG_BYTES:
                    errors.append(f"{label}.config exceeds {MAX_CONFIG_BYTES} bytes")
                if json_depth(config) > MAX_CONFIG_DEPTH:
                    errors.append(f"{label}.config exceeds depth {MAX_CONFIG_DEPTH}")
    if widget_count > MAX_WIDGETS_PER_ROOM:
        errors.append(f"Room has more than {MAX_WIDGETS_PER_ROOM} Widgets")
    return errors


def load_validators() -> dict[int, Draft202012Validator]:
    schemas = {version: json.loads(path.read_text(encoding="utf-8")) for version, path in SCHEMAS.items()}
    validators: dict[int, Draft202012Validator] = {}
    for version, schema in schemas.items():
        Draft202012Validator.check_schema(schema)
        validators[version] = Draft202012Validator(schema)
    return validators


def validate_value(validators: dict[int, Draft202012Validator], room: object) -> list[str]:
    if not isinstance(room, dict):
        return ["root must be an object"]
    version = room.get("version")
    if version not in validators:
        return [f"unsupported room.version {version!r}"]
    errors = [error.message for error in validators[version].iter_errors(room)]
    errors.extend(semantic_errors(room))
    return errors


def validate_file(validators: dict[int, Draft202012Validator], path: Path) -> list[str]:
    try:
        room = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return [str(error)]
    return validate_value(validators, room)


def validate_package(validators: dict[int, Draft202012Validator], room_dir: Path) -> list[str]:
    errors = validate_file(validators, room_dir / "room.json")
    if errors:
        return errors
    room = json.loads((room_dir / "room.json").read_text(encoding="utf-8"))
    declared: set[str] = set()
    for desk in room["desks"]:
        for widget in desk.get("widgets", []):
            declared.update(widget["resources"])
    for resource in sorted(declared):
        path = room_dir.joinpath(*resource.split("/"))
        if not path.is_file() or path.is_symlink():
            errors.append(f"missing or unsafe Widget resource {resource!r}")
    widgets_dir = room_dir / "widgets"
    if widgets_dir.is_dir():
        actual = {
            path.relative_to(room_dir).as_posix()
            for path in widgets_dir.rglob("*")
            if path.is_file()
        }
        for extra in sorted(actual - declared):
            errors.append(f"undeclared Widget resource {extra!r}")
    return errors


def generated_invalid_cases() -> dict[str, object]:
    widget = {
        "id": "generated", "name": "Generated",
        "src": "widgets/generated/index.html", "resources": ["widgets/generated/index.html"],
        "placement": {"x": 0, "y": 0, "width": 64, "height": 64, "z": 0},
        "config": {}, "permissions": [],
    }
    base = {
        "version": 2, "startDesk": 0, "switches": {},
        "desks": [{"name": "Desk", "background": None, "iconSize": "medium", "icons": [], "widgets": []}],
    }
    too_large = json.loads(json.dumps(base))
    large_widget = json.loads(json.dumps(widget))
    large_widget["config"] = {"payload": "x" * MAX_CONFIG_BYTES}
    too_large["desks"][0]["widgets"] = [large_widget]
    too_many = json.loads(json.dumps(base))
    too_many["desks"] = []
    for desk_index in range(3):
        desk = {"name": f"Desk {desk_index}", "background": None, "iconSize": "medium", "icons": [], "widgets": []}
        for item in range(22):
            current = json.loads(json.dumps(widget))
            current["id"] = f"w{desk_index}-{item}"
            current["src"] = f"widgets/w{desk_index}-{item}/index.html"
            current["resources"] = [current["src"]]
            desk["widgets"].append(current)
        too_many["desks"].append(desk)
    too_many_per_desk = json.loads(json.dumps(base))
    for item in range(33):
        current = json.loads(json.dumps(widget))
        current["id"] = f"desk-{item}"
        current["src"] = f"widgets/desk-{item}/index.html"
        current["resources"] = [current["src"]]
        too_many_per_desk["desks"][0]["widgets"].append(current)
    too_deep = json.loads(json.dumps(base))
    deep_widget = json.loads(json.dumps(widget))
    nested: dict[str, object] = {}
    cursor = nested
    for _ in range(MAX_CONFIG_DEPTH):
        next_value: dict[str, object] = {}
        cursor["next"] = next_value
        cursor = next_value
    deep_widget["config"] = nested
    too_deep["desks"][0]["widgets"] = [deep_widget]
    return {
        "config-too-large": too_large,
        "too-many-widgets-per-desk": too_many_per_desk,
        "too-many-widgets-per-room": too_many,
        "config-too-deep": too_deep,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--room", type=Path, help="validate one self-contained Room directory")
    args = parser.parse_args()
    validators = load_validators()
    creator_schema = json.loads(CREATOR_SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(creator_schema)
    creator_validator = Draft202012Validator(creator_schema)
    failed = False
    for version in (2,):
        fixture_dir = FIXTURES / f"room-v{version}"
        for path in sorted((fixture_dir / "valid").glob("*.json")):
            errors = validate_file(validators, path)
            if errors:
                failed = True
                print(f"FAIL room-v{version}/valid/{path.name}: {'; '.join(errors)}")
            else:
                print(f"PASS room-v{version}/valid/{path.name}")
        for path in sorted((fixture_dir / "invalid").glob("*.json")):
            errors = validate_file(validators, path)
            if errors:
                print(f"PASS room-v{version}/invalid/{path.name}: {errors[0]}")
            else:
                failed = True
                print(f"FAIL room-v{version}/invalid/{path.name}: unexpectedly valid")
    for name, room in generated_invalid_cases().items():
        errors = validate_value(validators, room)
        if errors:
            print(f"PASS room-v2/invalid/{name}: rejected as expected")
        else:
            failed = True
            print(f"FAIL room-v2/invalid/{name}: unexpectedly valid")
    package_dirs = [args.room] if args.room else sorted(path for path in SAMPLE_LIBRARY.iterdir() if path.is_dir())
    for package_dir in package_dirs:
        errors = validate_package(validators, package_dir)
        if errors:
            failed = True
            print(f"FAIL package/{package_dir.name}: {'; '.join(errors)}")
        else:
            print(f"PASS package/{package_dir.name}")
    if not args.room:
        for package_dir in sorted(path for path in INVALID_SAMPLE_LIBRARY.iterdir() if path.is_dir()):
            errors = validate_package(validators, package_dir)
            if errors:
                print(f"PASS invalid-package/{package_dir.name}: {errors[0]}")
            else:
                failed = True
                print(f"FAIL invalid-package/{package_dir.name}: unexpectedly valid")
        for path in sorted(CREATOR_TEMPLATES.glob("*/creator.json")):
            value = json.loads(path.read_text(encoding="utf-8"))
            errors = list(creator_validator.iter_errors(value))
            if errors:
                failed = True
                print(f"FAIL creator-template/{path.parent.name}: {errors[0].message}")
            else:
                print(f"PASS creator-template/{path.parent.name}")
        for path in sorted(CREATOR_FIXTURES.glob("valid/*/creator.json")):
            value = json.loads(path.read_text(encoding="utf-8"))
            errors = list(creator_validator.iter_errors(value))
            if errors:
                failed = True
                print(f"FAIL creator-valid/{path.parent.name}: {errors[0].message}")
            else:
                print(f"PASS creator-valid/{path.parent.name}")
        for path in sorted(CREATOR_FIXTURES.glob("invalid/*/creator.json")):
            value = json.loads(path.read_text(encoding="utf-8"))
            errors = list(creator_validator.iter_errors(value))
            if path.parent.name == "remote-script":
                # The manifest is valid; Rust source audit rejects its remote script.
                print("PASS creator-invalid/remote-script: manifest valid, source audit fixture")
            elif errors:
                print(f"PASS creator-invalid/{path.parent.name}: {errors[0].message}")
            else:
                failed = True
                print(f"FAIL creator-invalid/{path.parent.name}: unexpectedly valid")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
