use super::{room_v3, room_v3_authoring as author};
use serde_json::{json, Value};
fn document() -> Value {
    json!({"version":3,"apiVersion":1,"id":"231db51a-19db-4a3a-9c06-dbb9b3db86f9","name":"Author",
"startDesk":"home","resources":[],"transition":{"type":"slide","durationMs":450},
"desks":[{"id":"home","name":"Home","icons":[],"components":[]},{"id":"focus","name":"Focus","icons":[],"components":[]}]})
}
#[test]
fn creates_saves_reopens_and_installs_native_author_document() {
    let temp = tempfile::tempdir().unwrap();
    let room = author::create(temp.path(), "author", &document().to_string()).unwrap();
    let mut doc = room_v3::read_document(&room).unwrap();
    doc["desks"][1]["name"] = json!("Renamed");
    doc["startDesk"] = json!("focus");
    author::save(&room, &doc.to_string()).unwrap();
    assert_eq!(room_v3::read_document(&room).unwrap(), doc);
    assert_eq!(
        room_v3::install(&room, &temp.path().join("installed"))
            .unwrap()
            .room_id,
        doc["id"].as_str().unwrap()
    );
}
#[test]
fn imports_four_types_and_html_relative_dependencies_before_save() {
    let temp = tempfile::tempdir().unwrap();
    let room = author::create(temp.path(), "author", &document().to_string()).unwrap();
    let src = temp.path().join("source");
    std::fs::create_dir_all(src.join("nested")).unwrap();
    std::fs::write(src.join("picture.svg"), b"<svg/>").unwrap();
    std::fs::write(src.join("clip.mp4"), b"video").unwrap();
    std::fs::write(src.join("motion.gif"), b"GIF89a").unwrap();
    std::fs::write(
        src.join("index.html"),
        b"<link href='nested/style.css'><img src='picture.svg'>",
    )
    .unwrap();
    std::fs::write(src.join("nested/style.css"), b"body{color:white}").unwrap();
    let mut doc = document();
    for (file, kind) in [
        ("picture.svg", "image"),
        ("clip.mp4", "video"),
        ("motion.gif", "gif"),
        ("index.html", "html"),
    ] {
        let imported = author::import_content(&room, &src.join(file), kind).unwrap();
        assert_eq!(imported["content"]["type"], kind);
        for resource in imported["resources"].as_array().unwrap() {
            doc["resources"]
                .as_array_mut()
                .unwrap()
                .push(resource.clone());
        }
        doc["desks"][0]["background"] = imported["content"].clone();
    }
    author::save(&room, &doc.to_string()).unwrap();
    let reopened = room_v3::read_document(&room).unwrap();
    let source = reopened["desks"][0]["background"]["src"].as_str().unwrap();
    assert!(room
        .join(source)
        .parent()
        .unwrap()
        .join("nested/style.css")
        .is_file());
    assert_eq!(
        room_v3::install(&room, &temp.path().join("installed"))
            .unwrap()
            .resources
            .len(),
        doc["resources"].as_array().unwrap().len()
    );
}
#[test]
fn missing_resource_save_keeps_existing_manifest_and_identity() {
    let temp = tempfile::tempdir().unwrap();
    let room = author::create(temp.path(), "author", &document().to_string()).unwrap();
    let before = std::fs::read(room.join("room.json")).unwrap();
    let mut doc = document();
    doc["resources"] = json!(["assets/missing.svg"]);
    doc["desks"][0]["background"] = json!({"type":"image","src":"assets/missing.svg"});
    assert!(author::save(&room, &doc.to_string()).is_err());
    assert_eq!(std::fs::read(room.join("room.json")).unwrap(), before);
    doc = document();
    doc["id"] = json!("621db51a-19db-4a3a-9c06-dbb9b3db86f9");
    assert!(author::save(&room, &doc.to_string()).is_err());
    assert_eq!(std::fs::read(room.join("room.json")).unwrap(), before);
}
