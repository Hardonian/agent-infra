#!/usr/bin/env bash
# hx370-doctor — refreshable, sanitized node profile + health gate for the HX370 agent node.
#
# Purpose: detect the ACTUAL environment at dispatch time (volatile load/RAM/connectivity are
# re-probed, not cached), run the repository filesystem health gate, compute a conservative
# resource policy, and probe remote (EPYC) routing with a bounded timeout. Writes a sanitized
# machine-readable node-profile.json beside itself and prints a readable summary.
#
# Safety: read-only except (a) a write/fsync/read/delete round-trip in a dedicated temp dir on
# the repository filesystem and (b) rewriting node-profile.json. Never dumps serials, MACs,
# tokens, full network topology, env vars, or personal directory listings.
#
# Usage:
#   hx370-doctor.sh                 # full probe + write profile
#   hx370-doctor.sh --check-only    # probe + summary, do not write profile
#   hx370-doctor.sh --json          # print only the JSON profile to stdout
#
# Exit codes: 0 healthy, 2 filesystem gate FAILED (stop repo writes), 3 not on HX370-class host.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_PATH="${SCRIPT_DIR}/node-profile.json"
LOG_PATH="${SCRIPT_DIR}/hx370-doctor.log"
REPO_ROOT_DEFAULT="/home/scott"
REPO_MOUNT="${HX370_REPO_MOUNT:-$REPO_ROOT_DEFAULT}"
REMOTE_HOST="${HX370_REMOTE_PROBE_HOST:-100.127.74.34}"   # EPYC tailscale addr (override via env)
REMOTE_PROBE_PORT="${HX370_REMOTE_PROBE_PORT:-4000}"       # historical litellm port; override via env
PROBE_TIMEOUT="${HX370_PROBE_TIMEOUT:-6}"                 # bounded; seconds
WRITE_PROFILE=1
JSON_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --check-only) WRITE_PROFILE=0 ;;
    --json)       JSON_ONLY=1; WRITE_PROFILE=0 ;;
    -h|--help)    sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) printf 'unknown arg: %s\n' "$arg" >&2; exit 64 ;;
  esac
done

ts()   { date -u +%Y-%m-%dT%H:%M:%SZ; }
log()  { printf '[%s] %s\n' "$(ts)" "$*" >>"$LOG_PATH"; }
jq_get(){ printf '%s' "$1"; }  # passthrough helper (no jq dependency for capture)

# ---------- evidence capture (bounded, sanitized) ----------
OBSERVED_AT="$(ts)"
HOSTNAME_ACTUAL="$(hostname 2>/dev/null || echo unknown)"
KERNEL="$(uname -r 2>/dev/null || echo unknown)"
ARCH="$(uname -m 2>/dev/null || echo unknown)"
OS_PRETTY="$(. /etc/os-release 2>/dev/null && printf '%s' "${PRETTY_NAME:-unknown}")"

# WSL detection
IS_WSL=0
grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null && IS_WSL=1
WSL_GEN="unknown"
if [[ $IS_WSL -eq 1 ]] && command -v wslinfo >/dev/null 2>&1; then
  WSL_GEN="$(wslinfo --version 2>/dev/null | head -1 | tr -d '\r' || echo unknown)"
fi
HOST_CLASS="linux"
[[ $IS_WSL -eq 1 ]] && HOST_CLASS="wsl2"

# CPU
CPU_MODEL="$(lscpu 2>/dev/null | awk -F: '/Model name/{gsub(/^ +/,"",$2);print $2;exit}')"
CPU_NPROC="$(nproc 2>/dev/null || echo 0)"
CPU_THREADS_TOTAL="$(lscpu 2>/dev/null | awk -F: '/^CPU\(s\)/{gsub(/ /,"",$2);print $2;exit}')"

# Memory (WSL-visible) + swap
read -r MEM_TOTAL_KB MEM_AVAIL_KB <<<"$(awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{print t, a}' /proc/meminfo 2>/dev/null)"
read -r SWAP_TOTAL_KB <<<"$(awk '/SwapTotal/{print $2}' /proc/meminfo 2>/dev/null)"
MEM_TOTAL_GB="$(awk -v k="${MEM_TOTAL_KB:-0}" 'BEGIN{printf "%.1f", k/1048576}')"

# Storage for the repository mount (capacity + fs type + writability).
# NOTE: `df -T` and `--output` are mutually exclusive; use plain `df -hT` and parse columns.
REPO_FS_LINE="$(df -hT "$REPO_MOUNT" 2>/dev/null | tail -1 || echo unknown)"
REPO_FS_TYPE="$(printf '%s' "$REPO_FS_LINE" | awk '{print $2}')"
REPO_FS_SIZE="$(printf '%s' "$REPO_FS_LINE" | awk '{print $3}')"
REPO_FS_AVAIL="$(printf '%s' "$REPO_FS_LINE" | awk '{print $5}')"

# ---------- filesystem health gate (write/fsync/read/delete round-trip on the REPO mount) ----------
FS_GATE_STATUS="pass"
FS_GATE_EVIDENCE=""
GATE_DIR="${REPO_MOUNT}/.hermes/cache/scratch/hx370-fsgate-$$"
if mkdir -p "$GATE_DIR" 2>/dev/null; then
  GATE_FILE="${GATE_DIR}/gate.bin"
  GATE_PAYLOAD="fsgate-$(date +%s)-$$"
  if printf '%s\n' "$GATE_PAYLOAD" >"$GATE_FILE" 2>/dev/null \
     && sync "$GATE_FILE" 2>/dev/null \
     && [[ "$(cat "$GATE_FILE" 2>/dev/null)" == "$GATE_PAYLOAD" ]] \
     && rm -f "$GATE_FILE" 2>/dev/null; then
    FS_GATE_STATUS="pass"
    FS_GATE_EVIDENCE="write+fsync+readback+delete round-trip OK on ${REPO_FS_TYPE} at ${REPO_MOUNT}"
  else
    FS_GATE_STATUS="fail"
    FS_GATE_EVIDENCE="write/fsync/readback/delete FAILED on ${REPO_MOUNT} — STOP repo writes"
  fi
  rmdir "$GATE_DIR" 2>/dev/null || true
else
  FS_GATE_STATUS="fail"
  FS_GATE_EVIDENCE="cannot create temp dir on ${REPO_MOUNT} — STOP repo writes"
fi
log "fsgate ${FS_GATE_STATUS}: ${FS_GATE_EVIDENCE}"

# ---------- GPU / NPU compute reality (device listing is NOT compute evidence) ----------
GPU_VISIBLE="no"
GPU_MODEL="unknown"
GPU_COMPUTE_API="none"
if [[ -e /dev/dxg ]]; then GPU_VISIBLE="yes"; fi
if command -v powershell.exe >/dev/null 2>&1; then
  GPU_MODEL="$(powershell.exe -NoProfile -Command "(Get-CimInstance Win32_VideoController | Select-Object -First 1).Name" 2>/dev/null | tr -d '\r' | head -1)"
  [[ -z "$GPU_MODEL" ]] && GPU_MODEL="unknown"
fi
# A compute API is only claimed if a real runtime tool exists AND a probe op succeeds. We do not
# install anything; we only detect. Absence => CPU/remote fallback.
if command -v rocminfo >/dev/null 2>&1 || command -v hipcc >/dev/null 2>&1; then
  GPU_COMPUTE_API="rocm-present-unverified"
fi
NPU_VISIBLE="no"
ls /dev/accel* >/dev/null 2>&1 && NPU_VISIBLE="yes"
lsmod 2>/dev/null | grep -qiE 'xdna|amdxdna' && NPU_VISIBLE="module"

# ---------- toolchain presence (booleans only) ----------
have(){ command -v "$1" >/dev/null 2>&1 && echo true || echo false; }
HAVE_GIT="$(have git)"; HAVE_NODE="$(have node)"; HAVE_PYTHON="$(have python3)"
HAVE_DOCKER="$(have docker)"; HAVE_GH="$(have gh)"; HAVE_GO="$(have go)"
HAVE_CARGO="$(have cargo)"; HAVE_PS="$(have powershell.exe)"

# ---------- resource policy (conservative; 1 build worker for unknown load) ----------
LOAD1="$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo 0)"
# Budget: min(1, cores-2) build workers; keep >=2 cores + ~4GB for interactive use.
BUILD_WORKERS="$(awk -v c="$CPU_NPROC" 'BEGIN{w=int(c)-2; if(w<1)w=1; if(w>2)w=2; print w}')"
MEM_HEADROOM_GB="$(awk -v t="${MEM_TOTAL_GB:-0}" 'BEGIN{h=t-4.0; if(h<2)h=2; printf "%.1f", h}')"
ON_BATTERY="unknown"
if ls /sys/class/power_supply/BAT* >/dev/null 2>&1; then
  ON_BATTERY="$(cat /sys/class/power_supply/BAT*/status 2>/dev/null | head -1)"
fi

# ---------- remote routing probe (bounded; explicit offline state; no provider fallback) ----------
# ICMP-over-tailscale is often rate-limited/blocked and is the wrong signal for routing.
# Use a bounded TCP connect to a known service port (SSH=22 is a stable liveness anchor),
# plus an optional app port, to distinguish "node offline" from "app service not on that port".
tcp_probe(){ timeout "$PROBE_TIMEOUT" bash -c "exec 3<>/dev/tcp/$1/$2" 2>/dev/null && echo open || echo closed; }
REMOTE_STATUS="unknown"
REMOTE_SSH_PORT="$(tcp_probe "$REMOTE_HOST" 22)"
REMOTE_APP_PORT="$(tcp_probe "$REMOTE_HOST" "$REMOTE_PROBE_PORT")"
if [[ "$REMOTE_SSH_PORT" == "open" ]]; then
  REMOTE_STATUS="reachable"
elif command -v tailscale >/dev/null 2>&1 && timeout "$PROBE_TIMEOUT" tailscale status >/dev/null 2>&1; then
  # tailscale up but host not answering on 22: could be asleep/offline, not a routing outage.
  REMOTE_STATUS="unreachable"
else
  REMOTE_STATUS="no-transport"
fi
# Local inference gateway health (this node's own llm-api)
LOCAL_GW="unknown"
if timeout "$PROBE_TIMEOUT" curl -fsS -o /dev/null "http://127.0.0.1:8000/health" 2>/dev/null; then
  LOCAL_GW="healthy"
else
  LOCAL_GW="down"
fi

# ---------- host-class gate ----------
MATCH=0
case "$CPU_MODEL" in *HX*370*|*"HX 370"*) MATCH=1 ;; esac
[[ "$HOSTNAME_ACTUAL" == "HX370" ]] && MATCH=1

# ---------- assemble sanitized JSON (no serials/MACs/tokens/paths-of-home) ----------
read -r -d '' PROFILE_JSON <<JSONEOF || true
{
  "schema": "hx370.node-profile/v1",
  "observed_at": "${OBSERVED_AT}",
  "node_identity": {
    "enrollment_id": "hx370-dev-01",
    "hostname": "${HOSTNAME_ACTUAL}",
    "note": "stable id from enrollment, not a raw hardware identifier"
  },
  "host": {
    "class": "${HOST_CLASS}",
    "is_wsl": $([[ $IS_WSL -eq 1 ]] && echo true || echo false),
    "wsl_version": "${WSL_GEN}",
    "os": "${OS_PRETTY}",
    "kernel": "${KERNEL}",
    "arch": "${ARCH}"
  },
  "cpu": {
    "model": "${CPU_MODEL}",
    "nproc_effective": ${CPU_NPROC:-0},
    "threads_total": ${CPU_THREADS_TOTAL:-0}
  },
  "memory": {
    "total_gb_visible": ${MEM_TOTAL_GB:-0},
    "available_kb": ${MEM_AVAIL_KB:-0},
    "swap_total_kb": ${SWAP_TOTAL_KB:-0},
    "note": "WSL-visible; integrated GPU shares system memory (not independent)"
  },
  "storage": {
    "repo_mount": "${REPO_MOUNT}",
    "repo_fs_type": "${REPO_FS_TYPE}",
    "repo_fs_size": "${REPO_FS_SIZE}",
    "repo_fs_avail": "${REPO_FS_AVAIL}",
    "fs_gate": "${FS_GATE_STATUS}",
    "fs_gate_evidence": "${FS_GATE_EVIDENCE}"
  },
  "acceleration": {
    "gpu_visible": $([[ "$GPU_VISIBLE" == "yes" ]] && echo true || echo false),
    "gpu_model": "${GPU_MODEL:-unknown}",
    "gpu_compute_api": "${GPU_COMPUTE_API}",
    "gpu_compute_verified": false,
    "npu_visible": "${NPU_VISIBLE}",
    "npu_compute_verified": false,
    "note": "device listing is not compute evidence; no ROCm/DirectML/NPU runtime verified => CPU/remote fallback"
  },
  "toolchain": {
    "git": $HAVE_GIT, "node": $HAVE_NODE, "python": $HAVE_PYTHON,
    "docker": $HAVE_DOCKER, "gh": $HAVE_GH, "go": $HAVE_GO,
    "cargo": $HAVE_CARGO, "powershell_interop": $HAVE_PS
  },
  "resource_policy": {
    "load1": ${LOAD1:-0},
    "build_workers": ${BUILD_WORKERS},
    "mem_headroom_gb": ${MEM_HEADROOM_GB},
    "on_battery": "${ON_BATTERY}",
    "note": "conservative; increase only after measuring a known workload"
  },
  "routing": {
    "remote_epyc": "${REMOTE_STATUS}",
    "remote_ssh_port_22": "${REMOTE_SSH_PORT}",
    "remote_app_port_${REMOTE_PROBE_PORT}": "${REMOTE_APP_PORT}",
    "remote_host_role": "sustained inference / always-on shared services (verify, do not assume)",
    "local_inference_gateway": "${LOCAL_GW}",
    "policy": "private local endpoints default; remote requires verified auth; no provider fallback when offline"
  },
  "confidence": {
    "host_match_hx370": $([[ $MATCH -eq 1 ]] && echo true || echo false),
    "fs_gate": "${FS_GATE_STATUS}",
    "gpu_compute": "untested",
    "npu_compute": "untested",
    "remote_routing": "${REMOTE_STATUS}"
  }
}
JSONEOF

# ---------- output ----------
summary() {
  printf 'HX370 node doctor — observed %s\n' "$OBSERVED_AT"
  printf '  host           : %s (%s, %s) match_hx370=%s\n' "$HOSTNAME_ACTUAL" "$HOST_CLASS" "$KERNEL" "$([[ $MATCH -eq 1 ]] && echo yes || echo no)"
  printf '  cpu            : %s (%s effective cores)\n' "${CPU_MODEL:-?}" "${CPU_NPROC:-?}"
  printf '  memory         : %s GB visible, avail %s kB, swap %s kB\n' "${MEM_TOTAL_GB:-?}" "${MEM_AVAIL_KB:-?}" "${SWAP_TOTAL_KB:-?}"
  printf '  repo mount     : %s (%s, %s free) fs_gate=%s\n' "$REPO_MOUNT" "${REPO_FS_TYPE:-?}" "${REPO_FS_AVAIL:-?}" "$FS_GATE_STATUS"
  printf '  fs gate        : %s — %s\n' "$FS_GATE_STATUS" "$FS_GATE_EVIDENCE"
  printf '  gpu            : visible=%s (%s) compute=%s (verified=no)\n' "$GPU_VISIBLE" "${GPU_MODEL:-?}" "$GPU_COMPUTE_API"
  printf '  npu            : %s (verified=no)\n' "$NPU_VISIBLE"
  printf '  resource policy: build_workers=%s mem_headroom=%sGB load1=%s battery=%s\n' "$BUILD_WORKERS" "$MEM_HEADROOM_GB" "${LOAD1:-?}" "${ON_BATTERY}"
  printf '  remote epyc    : %s (ssh22=%s app:%s=%s, probe timeout %ss)\n' "$REMOTE_STATUS" "$REMOTE_SSH_PORT" "$REMOTE_PROBE_PORT" "$REMOTE_APP_PORT" "$PROBE_TIMEOUT"
  printf '  local gw :8000 : %s\n' "$LOCAL_GW"
}

if [[ $JSON_ONLY -eq 1 ]]; then
  printf '%s\n' "$PROFILE_JSON"
else
  summary
  if [[ $WRITE_PROFILE -eq 1 ]]; then
    printf '%s\n' "$PROFILE_JSON" >"$PROFILE_PATH"
    printf '  profile        : written %s\n' "$PROFILE_PATH"
  fi
fi

# Exit: filesystem gate failure is authoritative (stop repo writes); host mismatch is a warning.
if [[ "$FS_GATE_STATUS" == "fail" ]]; then
  log "EXIT 2 filesystem gate fail"
  exit 2
fi
if [[ $MATCH -eq 0 ]]; then
  log "WARN host does not match HX370-class"
fi
exit 0
