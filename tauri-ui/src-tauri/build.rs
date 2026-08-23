fn main() {
    tauri_build::build();

    let fds = protox::compile(
        ["proto/wallpaper.proto", "proto/display.proto"],
        ["proto/"],
    )
    .expect("failed to compile protos");

    tonic_build::configure()
        .build_client(true)
        .build_server(false)
        .compile_fds(fds)
        .expect("failed to generate grpc client code");
}
