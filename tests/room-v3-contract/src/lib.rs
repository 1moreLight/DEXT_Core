#[path = "../../../tauri-ui/src-tauri/src/room_v3.rs"]
pub mod room_v3;

#[cfg(test)]
mod tests {
    use super::room_v3::{install, validate_manifest, verify_installation};
    use serde_json::{json, Value};

    fn authored_source(root: &std::path::Path) -> std::path::PathBuf {
        let source = root.join("source");
        std::fs::create_dir_all(source.join("assets")).unwrap();
        let mut room = minimal();
        room["resources"] = json!(["assets/bg.svg"]);
        room["desks"][0]["background"] = json!({"type":"image","src":"assets/bg.svg"});
        std::fs::write(
            source.join("room.json"),
            serde_json::to_vec_pretty(&room).unwrap(),
        )
        .unwrap();
        std::fs::write(
            source.join("assets/bg.svg"),
            b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
        )
        .unwrap();
        source
    }

    #[test]
    fn installation_roundtrip_verifies_every_declared_byte() {
        let temp = tempfile::tempdir().unwrap();
        let source = authored_source(temp.path());
        let dest = temp.path().join("installed");
        let snapshot = install(&source, &dest).unwrap();
        assert_eq!(snapshot, verify_installation(&dest).unwrap());
        assert_eq!(snapshot.resources.len(), 1);
        assert_eq!(snapshot.resources[0].sha256.len(), 64);
        assert_eq!(
            std::fs::read(source.join("assets/bg.svg")).unwrap(),
            std::fs::read(dest.join("assets/bg.svg")).unwrap()
        );
        let encoded = std::fs::read_to_string(dest.join("installation.json")).unwrap();
        assert!(!encoded.contains(&source.to_string_lossy().to_string()));
    }

    #[test]
    fn changed_manifest_asset_or_added_file_invalidates_installation() {
        for target in ["room.json", "assets/bg.svg", "assets/extra.js"] {
            let temp = tempfile::tempdir().unwrap();
            let source = authored_source(temp.path());
            let dest = temp.path().join("installed");
            install(&source, &dest).unwrap();
            if target == "room.json" {
                let mut room: Value =
                    serde_json::from_slice(&std::fs::read(dest.join(target)).unwrap()).unwrap();
                room["name"] = json!("Changed");
                std::fs::write(dest.join(target), serde_json::to_vec(&room).unwrap()).unwrap();
            } else {
                std::fs::write(dest.join(target), b"tampered").unwrap();
            }
            assert!(
                verify_installation(&dest).is_err(),
                "accepted modified {target}"
            );
        }
    }

    #[test]
    fn invalid_source_keeps_previous_installation_intact() {
        for mutation in ["missing", "extra", "invalid"] {
            let temp = tempfile::tempdir().unwrap();
            let source = authored_source(temp.path());
            let dest = temp.path().join("installed");
            let old = install(&source, &dest).unwrap();
            match mutation {
                "missing" => std::fs::remove_file(source.join("assets/bg.svg")).unwrap(),
                "extra" => std::fs::write(source.join("assets/unlisted.js"), b"code").unwrap(),
                _ => std::fs::write(source.join("room.json"), b"{}").unwrap(),
            }
            assert!(install(&source, &dest).is_err());
            assert_eq!(old, verify_installation(&dest).unwrap());
        }
    }

    #[test]
    fn install_refuses_overlapping_paths_and_unowned_destination() {
        let temp = tempfile::tempdir().unwrap();
        let source = authored_source(temp.path());
        assert!(install(&source, &source).is_err());
        assert!(install(&source, &source.join("child")).is_err());
        assert!(install(&source, temp.path()).is_err());
        let dest = temp.path().join("personal");
        std::fs::create_dir(&dest).unwrap();
        std::fs::write(dest.join("keep.txt"), b"user data").unwrap();
        assert!(install(&source, &dest).is_err());
        assert_eq!(std::fs::read(dest.join("keep.txt")).unwrap(), b"user data");
    }

    #[test]
    fn reinstall_replaces_owned_snapshot_and_removes_old_resources() {
        let temp = tempfile::tempdir().unwrap();
        let source = authored_source(temp.path());
        let dest = temp.path().join("installed");
        let old = install(&source, &dest).unwrap();
        std::fs::remove_file(source.join("assets/bg.svg")).unwrap();
        std::fs::write(
            source.join("room.json"),
            serde_json::to_vec(&minimal()).unwrap(),
        )
        .unwrap();
        let new = install(&source, &dest).unwrap();
        assert_ne!(old.manifest_sha256, new.manifest_sha256);
        assert_eq!(new, verify_installation(&dest).unwrap());
        assert!(!dest.join("assets/bg.svg").exists());
        assert_eq!(std::fs::read_dir(temp.path()).unwrap().count(), 2);
    }

    #[cfg(windows)]
    #[test]
    fn locked_previous_installation_survives_failed_replacement() {
        use std::os::windows::fs::OpenOptionsExt;
        let temp = tempfile::tempdir().unwrap();
        let source = authored_source(temp.path());
        let dest = temp.path().join("installed");
        let old = install(&source, &dest).unwrap();
        let lock = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(dest.join("assets/bg.svg"))
            .unwrap();
        std::fs::write(source.join("assets/bg.svg"), b"new bytes").unwrap();
        assert!(install(&source, &dest).is_err());
        drop(lock);
        assert_eq!(old, verify_installation(&dest).unwrap());
        assert_eq!(std::fs::read_dir(temp.path()).unwrap().count(), 2);
    }

    #[cfg(windows)]
    #[test]
    fn resource_parent_junction_is_rejected_without_reading_external_content() {
        let temp = tempfile::tempdir().unwrap();
        let source = authored_source(temp.path());
        let outside = temp.path().join("outside");
        std::fs::create_dir(&outside).unwrap();
        std::fs::write(outside.join("bg.svg"), b"external").unwrap();
        std::fs::remove_file(source.join("assets/bg.svg")).unwrap();
        std::fs::remove_dir(source.join("assets")).unwrap();
        let output = std::process::Command::new("cmd")
            .args(["/c", "mklink", "/J"])
            .arg(source.join("assets"))
            .arg(&outside)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "junction fixture failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(install(&source, &temp.path().join("installed")).is_err());
        assert_eq!(std::fs::read(outside.join("bg.svg")).unwrap(), b"external");
    }

    #[test]
    fn checked_in_native_samples_follow_the_production_contract() {
        for sample in ["v3-basic", "v3-continuous"] {
            let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../rooms")
                .join(sample);
            let value: Value =
                serde_json::from_slice(&std::fs::read(root.join("room.json")).unwrap()).unwrap();
            let manifest = validate_manifest(&value).unwrap();
            for resource in manifest.resource_paths {
                assert!(root.join(resource).is_file());
            }
        }
    }

    #[test]
    fn shared_installed_fixture_is_verified_by_the_production_rust_boundary() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../dev_docs/fixtures/room-v3/installed-basic");
        let installation = verify_installation(&root).unwrap();
        assert_eq!(installation.resources.len(), 1);
    }

    #[test]
    fn configs_require_objects_and_exclude_nested_private_bindings() {
        let mut room = minimal();
        room["resources"] = json!(["scene/index.html"]);
        for config in [
            json!([]),
            json!("text"),
            json!({"nested":{"target":"C:/secret.exe"}}),
        ] {
            room["roomScene"] = json!({"entry":"scene/index.html","config":config});
            assert!(validate_manifest(&room).is_err());
        }
    }

    fn minimal() -> Value {
        json!({"version":3,"apiVersion":1,
            "id":"903f01db-fbdb-41a6-8019-a5124a665615","name":"Two Desk Room",
            "startDesk":"desk-a","resources":[],
            "desks":[{"id":"desk-a","name":"First","icons":[],"components":[]},
                     {"id":"desk-b","name":"Second","icons":[],"components":[]}]})
    }

    #[test]
    fn native_two_desk_manifest_uses_stable_identity() {
        let parsed = validate_manifest(&minimal()).unwrap();
        assert_eq!(parsed.room_id, "903f01db-fbdb-41a6-8019-a5124a665615");
        assert_eq!(parsed.desk_ids, ["desk-a", "desk-b"]);
        assert_eq!(parsed.start_desk_id, "desk-a");
    }

    #[test]
    fn room_scene_and_media_must_reference_declared_local_resources() {
        let mut room = minimal();
        room["resources"] = json!(["scene/index.html", "scene/main.js", "assets/photo.png"]);
        room["roomScene"] = json!({"entry":"scene/index.html","capabilities":["desk.read"]});
        room["desks"][0]["background"] = json!({"type":"image","src":"assets/photo.png"});
        assert_eq!(validate_manifest(&room).unwrap().resource_paths.len(), 3);
        room["roomScene"]["entry"] = json!("scene/missing.html");
        assert!(validate_manifest(&room).is_err());
    }

    #[test]
    fn reorder_and_rename_keep_default_desk_identity() {
        let mut room = minimal();
        room["desks"].as_array_mut().unwrap().reverse();
        room["desks"][1]["name"] = json!("Renamed");
        assert_eq!(validate_manifest(&room).unwrap().start_desk_id, "desk-a");
    }

    #[test]
    fn duplicate_missing_and_index_based_desk_ids_are_rejected() {
        for invalid in [json!("missing"), json!(0)] {
            let mut room = minimal();
            room["startDesk"] = invalid;
            assert!(validate_manifest(&room).is_err());
        }
        let mut room = minimal();
        room["desks"][1]["id"] = json!("desk-a");
        assert!(validate_manifest(&room).is_err());
        let mut room = minimal();
        room["desks"][0].as_object_mut().unwrap().remove("id");
        assert!(validate_manifest(&room).is_err());
    }

    #[test]
    fn native_format_rejects_unknown_fields_versions_and_personal_targets() {
        for key in ["launch", "bindings", "permissions", "__source", "password"] {
            let mut room = minimal();
            room[key] = json!({"target":"C:\\private\\app.exe"});
            assert!(validate_manifest(&room).is_err(), "accepted {key}");
        }
        for version in [0, 2, 4] {
            let mut room = minimal();
            room["version"] = json!(version);
            assert!(validate_manifest(&room).is_err());
        }
        let mut room = minimal();
        room["apiVersion"] = json!(2);
        assert!(validate_manifest(&room).is_err());
    }

    #[test]
    fn path_escape_windows_aliases_and_url_ambiguities_are_rejected() {
        for path in [
            "../a.js",
            "/a.js",
            "C:/a.js",
            "assets\\a.js",
            "assets/a.js:stream",
            "assets/../a.js",
            "https://evil/a.js",
            "assets/%2e%2e/a.js",
            "assets/a.js?x",
            "assets/a.js#x",
            "assets/con.js",
            "assets/AUX.png",
            "assets/a. ",
            "assets//a.js",
        ] {
            let mut room = minimal();
            room["resources"] = json!([path]);
            assert!(validate_manifest(&room).is_err(), "accepted {path}");
        }
    }

    #[test]
    fn case_collisions_undeclared_code_and_unknown_capabilities_are_rejected() {
        let mut room = minimal();
        room["resources"] = json!(["assets/a.js", "assets/A.js"]);
        assert!(validate_manifest(&room).is_err());
        room["resources"] = json!(["assets/run.exe"]);
        assert!(validate_manifest(&room).is_err());
        room["resources"] = json!(["scene/index.html"]);
        room["roomScene"] = json!({"entry":"scene/index.html","capabilities":["files.any"]});
        assert!(validate_manifest(&room).is_err());
    }

    #[test]
    fn portable_buttons_and_component_refs_are_checked() {
        let mut room = minimal();
        room["resources"] = json!(["widgets/clock.html"]);
        room["components"] = json!([{"id":"clock","role":"widget","entry":"widgets/clock.html",
            "capabilities":["time.read"],"placement":{"x":10,"y":10,"width":200,"height":100}}]);
        room["desks"][0]["components"] = json!(["clock"]);
        room["buttons"] = json!([{"id":"next","name":"Next","scope":"room","action":{"type":"desk.go","deskId":"desk-b"}},
            {"id":"app","name":"App","scope":"desk-a","action":{"type":"binding.launch"}}]);
        room["desks"][0]["icons"] =
            json!([{"id":"icon-a","buttonId":"app","label":"App","glyph":"◇","x":0,"y":0}]);
        assert!(validate_manifest(&room).is_ok());
        room["buttons"][0]["action"]["deskId"] = json!("missing");
        assert!(validate_manifest(&room).is_err());
        room["buttons"][0]["action"]["deskId"] = json!("desk-b");
        room["buttons"][1]["action"]["target"] = json!("C:/secret.exe");
        assert!(validate_manifest(&room).is_err());
    }

    #[test]
    fn cross_desk_button_references_and_duplicate_object_ids_are_rejected() {
        let mut room = minimal();
        room["buttons"] = json!([{"id":"app","name":"App","scope":"desk-b"}]);
        room["desks"][0]["icons"] = json!([{"id":"i","buttonId":"app","x":0,"y":0}]);
        assert!(validate_manifest(&room).is_err());
        room["buttons"] =
            json!([{"id":"app","name":"A","scope":"room"},{"id":"app","name":"B","scope":"room"}]);
        assert!(validate_manifest(&room).is_err());
    }
}
