fn main() {
    // Bundle libonnxruntime (sherpa-rs diarization) into Contents/Resources/
    // and add the rpath so dyld can find it at launch.
    #[cfg(target_os = "macos")]
    println!("cargo:rustc-link-arg=-Wl,-rpath,@executable_path/../Resources");

    // When cross-compiling (e.g. --target x86_64-apple-darwin on CI), Cargo writes
    // artefacts to target/<triple>/release/ — not target/release/.  tauri-build
    // validates the resource path in tauri.conf.json against target/release/, so we
    // copy libonnxruntime there from the sherpa-rs download cache before the check.
    #[cfg(target_os = "macos")]
    stage_onnxruntime_for_tauri_resources();

    tauri_build::build()
}

/// Copy libonnxruntime.1.17.1.dylib into target/release/ so tauri-build's
/// resource-existence check passes for both native and cross-compilation builds.
#[cfg(target_os = "macos")]
fn stage_onnxruntime_for_tauri_resources() {
    use std::path::PathBuf;

    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let dest = manifest_dir.join("target/release/libonnxruntime.1.17.1.dylib");

    if dest.exists() {
        return; // already there (native build or previous run)
    }

    // sherpa-rs-sys downloads onnxruntime to ~/Library/Caches/sherpa-rs/ and its
    // build script runs before ours, so the file is present by the time we get here.
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return,
    };
    let cache_root = PathBuf::from(home).join("Library/Caches/sherpa-rs");

    if let Some(src) = find_dylib(&cache_root, "libonnxruntime.1.17.1.dylib") {
        let _ = std::fs::create_dir_all(dest.parent().unwrap());
        match std::fs::copy(&src, &dest) {
            Ok(_) => println!(
                "cargo:warning=Staged onnxruntime for Tauri resources: {}",
                src.display()
            ),
            Err(e) => println!("cargo:warning=Could not stage onnxruntime: {e}"),
        }
    } else {
        println!("cargo:warning=libonnxruntime.1.17.1.dylib not found in sherpa-rs cache — tauri-build resource check may fail");
    }
}

#[cfg(target_os = "macos")]
fn find_dylib(dir: &std::path::Path, name: &str) -> Option<std::path::PathBuf> {
    fn search(
        dir: &std::path::Path,
        name: &str,
        depth: u8,
    ) -> Option<std::path::PathBuf> {
        if depth == 0 {
            return None;
        }
        for entry in std::fs::read_dir(dir).ok()?.flatten() {
            let path = entry.path();
            if path.file_name().and_then(|n| n.to_str()) == Some(name) {
                return Some(path);
            }
            if path.is_dir() {
                if let Some(found) = search(&path, name, depth - 1) {
                    return Some(found);
                }
            }
        }
        None
    }
    search(dir, name, 6)
}
