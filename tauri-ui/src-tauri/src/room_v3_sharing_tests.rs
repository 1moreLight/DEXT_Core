use super::*;
use std::collections::BTreeSet;

fn sample(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../dev_docs/fixtures/room-v3/release-api1").join(name)
}
fn assert_author_copy(source: &Path, copy: &Path, expected: &Value) {
    let document = room_v3::read_document(copy).unwrap();
    let mut normalized = document.clone();
    normalized["id"] = expected["id"].clone();
    normalized["name"] = expected["name"].clone();
    assert_eq!(&normalized, expected, "all Desk/component/resource references survive");
    assert_ne!(document["id"], expected["id"]);
    for resource in author_document(expected).unwrap().resource_paths {
        assert_eq!(fs::read(source.join(&resource)).unwrap(), fs::read(copy.join(resource)).unwrap());
    }
}
#[test]
fn six_author_samples_export_import_twice_and_install() {
    for kind in ["image", "video", "gif", "html", "continuous", "dock"] {
        let temp = tempfile::tempdir().unwrap();
        let source = sample(kind);
        let original = fs::read(source.join("room.json")).unwrap();
        let document = room_v3::read_document(&source).unwrap();
        let archive = temp.path().join("shared.zip");
        export(&source, &archive).unwrap();
        assert!(is_native_archive(&archive).unwrap());
        let mut zip = zip::ZipArchive::new(fs::File::open(&archive).unwrap()).unwrap();
        let names: BTreeSet<_> = (0..zip.len()).map(|i| zip.by_index(i).unwrap().name().to_owned()).collect();
        let expected: BTreeSet<_> = std::iter::once("room.json".to_owned())
            .chain(author_document(&document).unwrap().resource_paths).collect();
        assert_eq!(names, expected, "{kind}: only declared author files");
        drop(zip);
        let library = temp.path().join("library");
        let first = import(&library, &archive, Some("first")).unwrap();
        let second = import(&library, &archive, Some("second")).unwrap();
        assert_author_copy(&source, &first, &document);
        assert_eq!(room_v3::read_document(&first).unwrap()["name"], "first");
        assert_author_copy(&source, &second, &document);
        assert_eq!(room_v3::read_document(&second).unwrap()["name"], "second");
        assert_ne!(room_v3::read_document(&first).unwrap()["id"], room_v3::read_document(&second).unwrap()["id"]);
        let installed = temp.path().join("installed");
        room_v3::install(&second, &installed).unwrap();
        room_v3::verify_installation(&installed).unwrap();
        assert_eq!(fs::read(source.join("room.json")).unwrap(), original);
        println!("PASS {kind}: export, two independent imports, resource bytes, formal installation");
    }
}
#[test]
fn unsaved_draft_is_published_only_after_confirmation_and_cancel_cleans_staging() {
    let temp = tempfile::tempdir().unwrap();
    let source = sample("continuous");
    let original = fs::read(source.join("room.json")).unwrap();
    let mut draft = room_v3::read_document(&source).unwrap();
    draft["desks"][0]["name"] = Value::String("未保存的星轨".into());
    let library = temp.path().join("library");
    let pending = prepare_copy(&source, &library, "cancelled", &draft.to_string()).unwrap();
    assert!(!library.join("cancelled").exists());
    assert_ne!(pending.source_id, pending.room_id);
    drop(pending);
    assert_eq!(fs::read_dir(&library).unwrap().count(), 0);
    let pending = prepare_copy(&source, &library, "copied", &draft.to_string()).unwrap();
    let new_id = pending.room_id.clone();
    let copy = pending.publish().unwrap();
    assert_author_copy(&source, &copy, &draft);
    assert_eq!(room_v3::read_document(&copy).unwrap()["name"], "copied");
    assert_eq!(room_v3::read_document(&copy).unwrap()["id"], new_id);
    assert_eq!(fs::read(source.join("room.json")).unwrap(), original);
}
#[test]
fn copy_collision_and_missing_asset_leave_source_and_existing_destination_untouched() {
    let temp = tempfile::tempdir().unwrap();
    let source = sample("html");
    let original = fs::read(source.join("room.json")).unwrap();
    let draft = room_v3::read_document(&source).unwrap();
    let library = temp.path().join("library");
    let pending = prepare_copy(&source, &library, "collision", &draft.to_string()).unwrap();
    fs::create_dir(library.join("collision")).unwrap();
    fs::write(library.join("collision/keep.txt"), "keep").unwrap();
    assert!(pending.publish().is_err());
    assert_eq!(fs::read_to_string(library.join("collision/keep.txt")).unwrap(), "keep");
    assert_eq!(fs::read_dir(&library).unwrap().count(), 1);
    let broken = temp.path().join("broken");
    fs::create_dir(&broken).unwrap();
    fs::write(broken.join("room.json"), &original).unwrap();
    assert!(prepare_copy(&broken, &library, "missing", &draft.to_string()).is_err());
    assert!(!library.join("missing").exists());
    assert_eq!(fs::read_dir(&library).unwrap().count(), 1);
    assert_eq!(fs::read(source.join("room.json")).unwrap(), original);
}
#[test]
fn export_import_collisions_preserve_previous_files_and_can_retry() {
    let temp = tempfile::tempdir().unwrap();
    let archive = temp.path().join("shared.zip");
    export(&sample("dock"), &archive).unwrap();
    let bytes = fs::read(&archive).unwrap();
    assert!(export(&sample("image"), &archive).is_err());
    assert_eq!(fs::read(&archive).unwrap(), bytes);
    let library = temp.path().join("library");
    let first = import(&library, &archive, Some("first")).unwrap();
    let original = fs::read(first.join("room.json")).unwrap();
    assert!(import(&library, &archive, Some("first")).is_err());
    assert_eq!(fs::read(first.join("room.json")).unwrap(), original);
    assert!(import(&library, &archive, Some("retry")).is_ok());
    assert_eq!(fs::read_dir(&library).unwrap().count(), 2);
}
