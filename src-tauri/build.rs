fn main() {
    // Bundle libonnxruntime (sherpa-rs diarization) into Contents/Resources/
    // and add the rpath so dyld can find it at launch.
    #[cfg(target_os = "macos")]
    println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../Resources");

    tauri_build::build()
}
