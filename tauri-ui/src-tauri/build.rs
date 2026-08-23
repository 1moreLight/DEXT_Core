fn main() {
    tauri_build::build();

    let fds = protox::compile(
        [
            "proto/wallpaper.proto",
            "proto/display.proto",
            "proto/transport.proto",
        ],
        ["proto/"],
    )
    .expect("failed to compile protos");

    tonic_build::configure()
        .build_client(false)
        .build_server(false)
        .compile_fds(fds)
        .expect("failed to generate protobuf code");
}
