use dext_room_v3_contract_tests::room_v3;
use std::path::Path;
fn main() {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() != 3 || args[0] != "--install" {
        eprintln!("usage: install_v3 --install <source> <destination>");
        std::process::exit(2);
    }
    match room_v3::install(Path::new(&args[1]), Path::new(&args[2])) {
        Ok(snapshot) => println!(
            "{}",
            serde_json::to_string(&snapshot).expect("installation JSON")
        ),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
