# EPYC — llama-swap adoption (prepared 2026-11-08)

Status: **prepared, not deployed.** Blocked on EPYC SSH-tunnel operator approval (Tailscale SSH needs interactive per-session browser approval; unattended tunnels fail).

## Why
llama-swap v271 (MIT, 6.2K stars, actively released) gives the lab:
- OpenAI-compatible single endpoint in front of Ollama + on-demand llama.cpp GGUFs (more models than VRAM without paying resident RAM/VRAM)
- warm / spillover / pin selectors + peers for multi-machine routing (HX370 <-> EPYC later)
- Prometheus metrics + web swap-matrix UI for the status board
- same tool can later manage ComfyUI server swaps (deferred — current SDXL->3060 / SD1.5->P40 rules stay)

## Verified today (HX370 side)
- `llama-swap_271_linux_amd64.tar.gz` downloaded, binary `--version` runs.
- Config `llama-swap.yaml` authored here with placeholders + full deploy checklist incl. rollback.

## Gate to execution
1. Operator approves tunnel.
2. Run deploy checklist in `llama-swap.yaml` (validate config -> user unit on 127.0.0.1:11435 -> canary Open WebUI only).
3. 48h clean -> promote; else one-systemd-stop rollback.
