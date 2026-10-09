use super::{room_v3, room_v3_authoring as author, room_v3_dock as dock};
use serde_json::{json, Value};
fn document() -> Value {
    json!({"version":3,"apiVersion":1,"id":"231db51a-19db-4a3a-9c06-dbb9b3db86f9","name":"Dock",
  "startDesk":"home","resources":[],"desks":[{"id":"home","name":"Home","icons":[],"components":[]},{"id":"focus","name":"Focus","icons":[],"components":[]}]})
}
#[test]
fn official_catalog_exposes_parameters_regions_and_all_open_data_examples() {
    let templates = dock::list().unwrap();
    assert_eq!(templates.len(), 2);
    let panels = templates
        .iter()
        .find(|d| d["id"] == "three-panels")
        .unwrap();
    assert!(panels["parameters"].as_array().unwrap().len() > 1);
    assert!(panels["regions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|r| r["id"] == "left" && r["kind"] == "data"));
    for capability in ["time.read", "hardware.read", "media.read", "audio.read"] {
        assert!(panels["examples"]
            .as_array()
            .unwrap()
            .iter()
            .any(|e| e["source"]["capability"] == capability));
    }
}
#[test]
fn copies_complete_template_sdk_and_descriptor_then_saves_reopens_and_installs_same_room() {
    let temp = tempfile::tempdir().unwrap();
    let room = author::create(temp.path(), "author", &document().to_string()).unwrap();
    for template in ["three-panels", "navigation-bar"] {
        let before = std::fs::read(room.join("room.json")).unwrap();
        let imported = dock::import(&room, template).unwrap();
        assert_eq!(before, std::fs::read(room.join("room.json")).unwrap());
        assert_eq!(imported["descriptor"]["id"], template);
        let resources = imported["resources"].as_array().unwrap();
        assert_eq!(resources.len(), 5);
        for value in resources {
            assert!(!std::fs::read(room.join(value.as_str().unwrap()))
                .unwrap()
                .is_empty());
        }
        assert!(resources
            .iter()
            .any(|v| v.as_str().unwrap().ends_with("/dext-sdk.v1.js")));
        let mut doc = room_v3::read_document(&room).unwrap();
        doc["resources"]
            .as_array_mut()
            .unwrap()
            .extend(resources.iter().cloned());
        doc["components"] = json!([{"id":"dock","role":"dock","entry":imported["entry"],"placement":imported["descriptor"]["placement"],
    "capabilities":["time.read","hardware.read","media.read","audio.read","desk.read","desk.navigate","binding.launch","dext.exit"],
    "config":{"template":imported["descriptor"]}}]);
        doc["dockComponentId"] = json!("dock");
        doc["desks"][0]["components"] = json!(["dock"]);
        doc["desks"][1]["components"] = json!(["dock"]);
        author::save(&room, &doc.to_string()).unwrap();
        assert_eq!(
            dock::inspect(&room, "dock").unwrap(),
            imported["descriptor"]
        );
        let installed =
            room_v3::install(&room, &temp.path().join(format!("installed-{template}"))).unwrap();
        assert_eq!(installed.room_id, doc["id"].as_str().unwrap());
    }
}
#[test]
fn failed_template_selection_keeps_saved_document_and_assets_unchanged() {
    let temp = tempfile::tempdir().unwrap();
    let room = author::create(temp.path(), "author", &document().to_string()).unwrap();
    let before = std::fs::read(room.join("room.json")).unwrap();
    assert!(dock::import(&room, "not-installed").is_err());
    assert_eq!(before, std::fs::read(room.join("room.json")).unwrap());
    assert!(!room.join("assets").exists());
    assert!(dock::inspect(&room, "not-a-component").is_err());
}
