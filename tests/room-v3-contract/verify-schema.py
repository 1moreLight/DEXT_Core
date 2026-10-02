"""Check the published Room v3 shape against committed native samples."""
import copy
import json
from pathlib import Path
from jsonschema import Draft202012Validator

root = Path(__file__).resolve().parents[2]
schema = json.loads((root / "room-v3.schema.json").read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)
for name in ("v3-basic", "v3-continuous"):
    room = json.loads((root / "rooms" / name / "room.json").read_text(encoding="utf-8"))
    validator.validate(room)
    for mutation in (lambda r: r.update(version=2), lambda r: r.update(bindings={"private": "target"}),
                     lambda r: r.update(startDesk=0)):
        invalid = copy.deepcopy(room)
        mutation(invalid)
        assert list(validator.iter_errors(invalid)), "schema accepted invalid manifest"
print("PASS v3 schema: both native samples; version, private-field and identity negatives")
