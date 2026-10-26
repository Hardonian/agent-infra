# HX370 Runbook

Operational guide for the HX370 development/agent node. Facts re-verified by
[`hx370-doctor.sh`](hx370-doctor.sh); do not trust cached load/connectivity from this file.

## 1. Daily start / stop

**Start (WSL):** From Windows: `wsl -d Ubuntu` (or open a terminal). Confirm the session is on
HX370 before doing work:
```
hostname   # expect: HX370
```
Then run the doctor and read the health gate:
```
/home/scott/repos/agent-infra/nodes/hx370/hx370-doctor.sh
# exit 0 = healthy; exit 2 = filesystem gate FAILED (stop repo writes, see §6)
```

**Start (Hermes local services):** systemd user units already exist and linger on:
```
systemctl --user status llm-inference-api hermes-gateway   # healthy?
curl -fsS http://127.0.0.1:8000/health && echo " llm-api OK"
```

**Stop / suspend:** WSL can be suspended from Windows (`wsl --shutdown`) — this ends all running
work in the distro. Save git state first. Graceful service stop:
```
systemctl --user stop llm-inference-api        # stop the local inference gateway
```
Rollback of anything this node changed: see §8.

## 2. Node capabilities (summary)
Local, capability-proven: repo implementation (worktrees, bounded builds/tests), local browser/UI
checks, lightweight research, credential-brokered tool calls. Not supported locally: GPU/NPU
acceleration (untested — CPU/remote only), always-on schedules, canonical shared memory.
Full list + evidence: [`HX370.md`](HX370.md).

## 3. Local vs remote work selection
Run the doctor, then decide:
- **Local** if the task is repo edits/tests/UI, lightweight research, or reversible edits.
- **Remote (EPYC)** only for sustained inference / heavy compute / always-on services — and only
  after a fresh reachability probe confirms the service is actually up and authenticated:
  ```
  timeout 6 bash -c 'echo > /dev/tcp/100.127.74.34/22' && echo "EPYC reachable" || echo "EPYC offline"
  ```
- **Never** assume EPYC ownership of a service. Verify service health before routing to it.
- If EPYC is offline: offer local CPU capability; mark remote-dependent actions **pending/blocked**;
  never silently fall back to a hosted/paid model for sensitive work.

## 4. Android / Termux access
Access through the **existing authorized transport** only (Tailscale + SSH). No new port forwards,
no public exposure of the local gateway.
```
# from Termux on the same tailnet:
ssh scott@100.106.185.67      # HX370 tailscale addr (verify current: tailscale status)
```
Do not weaken SSH host-key checks or TLS validation to obtain connectivity. Terminal commands stay
first-class; the private dashboard (Hermes gateway) is bound locally/ tailscale, never Internet-facing.

## 5. Resource policy
- Build/test workers: **2** (start at 1 for unknown workloads). Override per-run:
  `HX370_BUILD_WORKERS=1 <cmd>` — never silently change OS power settings.
- Keep ~15.5 GiB RAM headroom for interactive use. The iGPU shares system RAM — do not budget it
  as independent. Do not disable swap, enlarge WSL limits, or touch BIOS/drivers/kernels.
- Under battery/resource pressure pause non-essential background work (battery state is `unknown`
  in WSL; treat a laptop as possibly on-battery).

## 6. WSL recovery boundary (filesystem / I/O errors)
This machine previously showed read-only filesystems and I/O errors. The repo mount is gated by
`hx370-doctor.sh` (write+fsync+readback+delete round-trip). If the gate reports **fail**:
1. **Stop writes to the affected filesystem immediately.** Do not retry writes, remount, run
   destructive repair, unregister/recreate the distro, move the VHDX, or assume a copy is intact.
2. Collect bounded read-only evidence: `dmesg | tail -50`, `mount | grep ' / '`, `df -hT`.
3. Continue only on a separately verified healthy location. A `/tmp` write does **not** prove a
   repo on another mount is healthy — gate each mount independently.
4. Host-side (Windows) recovery, if it comes to that, is a **manual, data-protective** step and
   must account for all running WSL work (it requires `wsl --shutdown`). Exact steps:
   - `wsl --shutdown` (ends running work) → `wsl --update` → reboot Windows → re-run the gate.
   - Only as a last resort, `wsl --chkdsk <Distro>` (read-oriented) — never re-register/recreate.
5. Keep the limitation visible in release status; never claim the filesystem healthy without a
   passing gate.

## 7. Offline behavior
HX370 may sleep, reboot, or roam. It is **never** the sole owner of always-on schedules, canonical
memory, or authoritative shared queues. When offline:
- Finish local authorized edits/checks and drafts; mark submissions **pending**.
- On reconnect, reconcile by stable job/idempotency key + current policy. **Never** replay old
  approvals blindly or create a divergent copy of shared memory. Offline drafts are not approved
  external effects.

## 8. Enrollment / revocation & rollback
- Stable node id `hx370-dev-01` comes from enrollment, not a hardware identifier. Short-lived worker
  credentials + scoped job claims + heartbeats + lease expiry + fencing tokens (checked at effect
  boundaries) prevent a stale worker committing after reassignment. (Shared-side enforcement lives
  in `agent-mesh` `internal/fleet`/`identity` — see the requirements matrix in the release report.)
- **Rollback** of this node's changes:
  ```
  cd /home/scott/repos/agent-infra
  git checkout -- nodes/hx370            # revert uncommitted node files
  git revert <commit>                    # revert the committed node-profile/role change
  # Hermes role guidance: restore the config backup taken before the edit (see release report)
  ```

## 9. Troubleshooting
| Symptom | Check | Action |
|---|---|---|
| `hostname` ≠ HX370 | wrong distro/host | `wsl -l -v`; do not configure a different machine as HX370 |
| doctor exit 2 | filesystem gate fail | §6 — stop repo writes, bounded read-only evidence |
| llm-api :8000 down | `systemctl --user status llm-inference-api` | restart unit; re-probe health |
| EPYC "unreachable" | TCP:22 probe, `tailscale status` | node may be asleep — not a routing outage; mark remote pending |
| GPU/NPU expected but slow | doctor shows compute unverified | local accel is untested — CPU/remote is expected; do not install ROCm without need |
| git write fails on a mount | gate that specific mount | do not assume `/tmp` health; gate the repo mount |
