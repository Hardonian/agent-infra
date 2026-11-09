//! Execution-side sandbox verification: every assertion below runs a REAL child process through
//! the exact primitives the proxy uses (`apply_sandbox`, `arm_timeout`, `kill_process_group`) and
//! proves the isolation effect, not just config validation. Namespace/UID tests require root and
//! skip otherwise (same pattern as the durable-Postgres tests in agent-mesh).

use mcpwall::config::SandboxPolicy;
use mcpwall::sandbox::{apply_sandbox, arm_timeout, kill_process_group};
use std::fs;
use std::os::unix::process::ExitStatusExt;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::Ordering;
use std::time::Instant;

fn sh_script(script: &str, sandbox: &SandboxPolicy) -> std::io::Result<std::process::Output> {
    let mut cmd = Command::new("/bin/sh");
    cmd.arg("-c").arg(script);
    apply_sandbox(&mut cmd, sandbox)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidInput, e))?;
    cmd.output()
}

fn base() -> SandboxPolicy {
    SandboxPolicy {
        enabled: true,
        ..Default::default()
    }
}

fn temp_tag(name: &str) -> PathBuf {
    let mut p = std::env::temp_dir();
    p.push(format!("mcpwall-sbx-{name}-{}", std::process::id()));
    p
}

fn ns_link(path: &str) -> String {
    fs::read_link(path)
        .map(|l| l.to_string_lossy().into_owned())
        .unwrap_or_default()
}

// ---------------------------------------------------------------- environment

#[test]
fn clears_environment_except_allowlist() {
    unsafe { std::env::set_var("MCPWALL_SECRET_MARKER", "leak-canary") };
    let sandbox = SandboxPolicy {
        clear_environment: true,
        environment_allowlist: vec!["PATH".into()],
        ..base()
    };
    let out = sh_script(
        r#"printf 'PATH=%s HOME=%s MARKER=%s\n' "${PATH:+yes}" "${HOME:+yes}" "${MCPWALL_SECRET_MARKER:+yes}""#,
        &sandbox,
    )
    .expect("spawn");
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    assert!(out.status.success(), "child failed: {stdout}");
    assert!(
        stdout.contains("PATH=yes"),
        "allowlisted PATH must survive: {stdout}"
    );
    assert!(
        !stdout.contains("HOME=yes"),
        "HOME must be scrubbed: {stdout}"
    );
    assert!(
        !stdout.contains("MARKER=yes"),
        "secret env must be scrubbed: {stdout}"
    );
    unsafe { std::env::remove_var("MCPWALL_SECRET_MARKER") };
}

#[test]
fn allowlist_without_clear_is_rejected() {
    let sandbox = SandboxPolicy {
        clear_environment: false,
        environment_allowlist: vec!["PATH".into()],
        ..base()
    };
    let mut cmd = Command::new("/bin/sh");
    cmd.arg("-c").arg("true");
    let err = apply_sandbox(&mut cmd, &sandbox).expect_err("must reject");
    assert!(err.contains("clear_environment"), "unexpected: {err}");
}

// ---------------------------------------------------------------- working dir

#[test]
fn working_dir_is_enforced_and_validated() {
    let dir = temp_tag("cwd");
    fs::create_dir_all(&dir).expect("mkdir");
    let sandbox = SandboxPolicy {
        working_dir: Some(dir.clone()),
        ..base()
    };
    let out = sh_script("pwd", &sandbox).expect("spawn");
    let got = fs::canonicalize(String::from_utf8_lossy(&out.stdout).trim()).unwrap();
    assert_eq!(got, fs::canonicalize(&dir).unwrap(), "child cwd mismatch");

    let mut cmd = Command::new("/bin/sh");
    cmd.arg("-c").arg("true");
    let bad = SandboxPolicy {
        working_dir: Some(PathBuf::from("/nonexistent-mcpwall-dir")),
        ..base()
    };
    assert!(
        apply_sandbox(&mut cmd, &bad).is_err(),
        "missing dir must error"
    );
    let _ = fs::remove_dir(&dir);
}

// ---------------------------------------------------------------- seccomp + no-new-privs

#[test]
fn seccomp_denies_dangerous_syscalls_in_real_child() {
    assert!(
        PathBuf::from("/usr/bin/unshare").exists(),
        "test requires util-linux unshare(1) as the denied-syscall probe"
    );
    let sandbox = SandboxPolicy {
        seccomp_deny_dangerous: true,
        ..base()
    };
    // 1) Filter must be attached (Seccomp: 2) with NO_NEW_PRIVS=1 (pre_exec installs both).
    let out = sh_script(
        "grep -E '^Seccomp:|^NoNewPrivs:' /proc/self/status",
        &sandbox,
    )
    .expect("spawn");
    // /proc lines are TAB-separated; normalize whitespace before matching.
    let stdout = String::from_utf8_lossy(&out.stdout)
        .replace('\t', " ")
        .to_string();
    assert!(out.status.success(), "grep failed: {stdout}");
    assert!(
        stdout.contains("Seccomp: 2"),
        "seccomp filter not active:\n{stdout}"
    );
    assert!(
        stdout.contains("NoNewPrivs: 1"),
        "no-new-privs not set:\n{stdout}"
    );

    // 2) unshare(2) is on the deny list -> EPERM in the sandboxed child.
    let blocked = sh_script("unshare -U true; echo RC=$?", &sandbox).expect("spawn");
    let mut blocked_out = String::from_utf8_lossy(&blocked.stdout).to_string();
    blocked_out.push_str(&String::from_utf8_lossy(&blocked.stderr));
    assert!(
        !blocked_out.contains("RC=0"),
        "sandboxed unshare must be denied: {blocked_out}"
    );
    assert!(
        blocked_out.to_lowercase().contains("not permitted"),
        "expected EPERM from seccomp, got: {blocked_out}"
    );

    // Control: same unshare works unsandboxed (proves the denial comes from the filter).
    let free = Command::new("/usr/bin/unshare")
        .arg("-U")
        .arg("/bin/true")
        .output()
        .expect("control spawn");
    assert!(
        free.status.success(),
        "control unshare unexpectedly failed: {}",
        String::from_utf8_lossy(&free.stderr)
    );
}

// ---------------------------------------------------------------- rlimits

#[test]
fn rlimits_are_applied_to_the_child() {
    let sandbox = SandboxPolicy {
        max_open_files: 64,
        max_memory_bytes: 512 * 1024 * 1024,
        ..base()
    };
    let out = sh_script("ulimit -n; ulimit -v", &sandbox).expect("spawn");
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let mut lines = stdout.trim().lines().map(str::trim);
    assert_eq!(lines.next(), Some("64"), "RLIMIT_NOFILE: {stdout}");
    assert_eq!(lines.next(), Some("524288"), "RLIMIT_AS (KB): {stdout}");
}

#[test]
fn fsize_limit_kills_writers() {
    let path = temp_tag("fsize.bin");
    let _ = fs::remove_file(&path);
    let sandbox = SandboxPolicy {
        max_file_bytes: 4096,
        ..base()
    };
    // 32 KiB via dd under a 4 KiB RLIMIT_FSIZE -> SIGXFSZ kills the shell itself.
    let out = sh_script(
        &format!(
            "dd if=/dev/zero of={} bs=512 count=64 2>/dev/null; echo RC=$?",
            path.display()
        ),
        &sandbox,
    )
    .expect("spawn");
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let killed_by_xfsz = out.status.signal() == Some(25) || out.status.code() == Some(153);
    let reported_failure = stdout.contains("RC=153") || stdout.contains("RC=149");
    assert!(
        !stdout.contains("RC=0"),
        "dd past RLIMIT_FSIZE must not succeed: {stdout}"
    );
    assert!(
        killed_by_xfsz || reported_failure,
        "expected SIGXFSZ termination, got code={:?} signal={:?} out={stdout}",
        out.status.code(),
        out.status.signal(),
    );
    let _ = fs::remove_file(&path);
}

#[test]
fn cpu_limit_terminates_a_busy_loop() {
    let sandbox = SandboxPolicy {
        max_cpu_seconds: 1,
        ..base()
    };
    let started = Instant::now();
    let out = sh_script("i=0; while :; do i=$((i+1)); done", &sandbox).expect("spawn");
    // RLIMIT_CPU soft limit delivers SIGXCPU(24); dash reports 128+24=152 if it reaps it itself.
    let died_by_cpu =
        matches!(out.status.signal(), Some(24) | Some(9)) || out.status.code() == Some(152);
    assert!(
        died_by_cpu,
        "busy loop not terminated by RLIMIT_CPU: {:?}",
        out.status
    );
    assert!(
        started.elapsed().as_secs() < 30,
        "took {}s",
        started.elapsed().as_secs()
    );
}

// ---------------------------------------------------------------- timeout watchdog

#[test]
fn timeout_watchdog_kills_the_whole_process_group() {
    let sandbox = base(); // timeout enforcement lives in arm_timeout, mirroring proxy usage
    let mut cmd = Command::new("/bin/sh");
    // apply_sandbox's pre_exec calls setsid, so the child PID is the process-group leader.
    cmd.arg("-c").arg("sleep 30 | cat & sleep 30");
    apply_sandbox(&mut cmd, &sandbox).expect("apply");
    cmd.stdout(Stdio::null()).stderr(Stdio::null());
    let mut child = cmd.spawn().expect("spawn");
    let (finished, watchdog) = arm_timeout(child.id(), 1);
    let started = Instant::now();
    let status = child.wait().expect("wait");
    finished.store(true, Ordering::SeqCst);
    if let Some(h) = watchdog {
        let _ = h.join();
    }
    assert!(
        !status.success(),
        "sleep pipeline must be killed, got {status:?}"
    );
    assert!(
        started.elapsed().as_secs() < 10,
        "kill took {:?}",
        started.elapsed()
    );
}

#[test]
fn kill_process_group_is_idempotent_after_exit() {
    let mut cmd = Command::new("/bin/sh");
    cmd.arg("-c").arg("true");
    apply_sandbox(&mut cmd, &base()).expect("apply");
    let mut child = cmd.spawn().expect("spawn");
    let _ = child.wait();
    kill_process_group(&mut child); // must not panic
}

// ---------------------------------------------------------------- namespaces (root-gated)

fn am_root() -> bool {
    unsafe { libc::geteuid() == 0 }
}

#[test]
fn network_namespace_isolates_the_child() {
    if !am_root() {
        eprintln!("SKIP: network-namespace test requires root (CLONE_NEWNET needs CAP_SYS_ADMIN)");
        return;
    }
    let sandbox = SandboxPolicy {
        network_namespace: true,
        ..base()
    };
    let parent_ns = ns_link("/proc/self/ns/net");
    let out = sh_script(
        "readlink /proc/self/ns/net; ls /sys/class/net | grep -cv '^lo$'",
        &sandbox,
    )
    .expect("spawn");
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let child_ns = stdout.lines().next().unwrap_or("").trim().to_string();
    assert!(
        !child_ns.is_empty() && child_ns != parent_ns,
        "netns unchanged: {child_ns}"
    );
    // Only lo exists in the fresh namespace -> `grep -cv '^lo$'` prints 0 and exits 1.
    assert_eq!(
        stdout.lines().nth(1).map(str::trim),
        Some("0"),
        "expected 0 non-loopback interfaces, got: {stdout}"
    );
}

#[test]
fn mount_namespace_read_only_blocks_writes() {
    if !am_root() {
        eprintln!("SKIP: mount-namespace test requires root");
        return;
    }
    let probe = temp_tag("ro-write-test");
    let _ = fs::remove_file(&probe);
    fs::write(&probe, b"host").expect("write host file");
    let sandbox = SandboxPolicy {
        mount_namespace: true,
        read_only_filesystem: true,
        ..base()
    };
    let out = sh_script(
        &format!("echo sandbox > {} 2>&1; echo RC=$?", probe.display()),
        &sandbox,
    );
    match out {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            assert!(
                !stdout.contains("RC=0"),
                "write succeeded in RO fs: {stdout}"
            );
        }
        Err(e) => panic!("sandboxed spawn failed: {e}"),
    }
    // Host file untouched (mount ns is private; the child never affected it).
    assert_eq!(fs::read_to_string(&probe).unwrap_or_default(), "host");
    let _ = fs::remove_file(&probe);
}

#[test]
fn unpaired_uid_fails_at_spawn() {
    let sandbox = SandboxPolicy {
        run_as_uid: Some(65534),
        run_as_gid: None,
        ..base()
    };
    // pre_exec errors surface to the parent only as their errno (EINVAL); the
    // "must be paired" validation never reaches the child's exec.
    let err = sh_script("true", &sandbox).expect_err("unpaired uid/gid must fail pre_exec");
    assert!(
        err.raw_os_error() == Some(libc::EINVAL) || err.kind() == std::io::ErrorKind::InvalidInput,
        "unexpected error: {err:?}"
    );
}
