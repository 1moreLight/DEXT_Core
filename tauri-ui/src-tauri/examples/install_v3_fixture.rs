// Local acceptance utility: production installer only; does not start Core or grant permissions.
#[allow(dead_code, unused_imports)]
#[path = "../src/room_v3.rs"]
mod room_v3;
fn main() {
    let args: Vec<_> = std::env::args_os().collect();
    assert_eq!(args.len(), 3, "usage: install_v3_fixture SOURCE EMPTY_DESTINATION");
    let destination = std::path::Path::new(&args[2]);
    assert!(!destination.exists(), "destination must not exist");
    let installed = room_v3::install(std::path::Path::new(&args[1]), destination).expect("production installation failed");
    assert_eq!(room_v3::verify_installation(destination).unwrap(), installed);
    println!("Installed verified Room {} with {} resources", installed.room_id, installed.resources.len());
}
