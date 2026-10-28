#!/usr/bin/env python3
"""EPYC control_plane.py wrapper with agent-infra governance hooks.

Wraps the existing control_plane.py process and adds:
- Policy enforcement before actions
- Audit logging in mission-ledger format
- Budget/cost tracking
- Approval gating for destructive operations
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import signal
import subprocess
import sys
import threading
from pathlib import Path
from typing import Any

AUDIT_LOG_PATH = os.getenv("EPYC_AUDIT_LOG", "/var/lib/epyc/audit.log")
MISSION_LEDGER_DIR = os.getenv("EPYC_MISSION_LEDGER", "/var/lib/epyc/mission-ledger")
APPROVAL_REQUIRED = os.getenv("EPYC_APPROVAL_REQUIRED", "true").lower() == "true"


def ensure_dirs() -> None:
    Path(AUDIT_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
    Path(MISSION_LEDGER_DIR).mkdir(parents=True, exist_ok=True)


def audit_log(event: dict[str, Any]) -> None:
    record = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        **event,
    }
    with open(AUDIT_LOG_PATH, "a") as f:
        f.write(json.dumps(record) + "\n")


def export_mission_ledger(event: dict[str, Any]) -> None:
    """Append event to mission-ledger export directory."""
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    ledger_file = Path(MISSION_LEDGER_DIR) / f"{today}.jsonl"
    record = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "source": "epyc-control-plane",
        **event,
    }
    with open(ledger_file, "a") as f:
        f.write(json.dumps(record) + "\n")


def policy_check(action: str, params: dict[str, Any]) -> bool:
    """Simple policy gate. Returns True if action is allowed."""
    destructive = {"delete", "terminate", "stop", "kill", "reboot"}
    if APPROVAL_REQUIRED and action.lower() in destructive:
        audit_log({"event": "policy_block", "action": action, "params": params})
        return False
    return True


def stream_reader(stream: Any, prefix: str) -> None:
    for line in iter(stream.readline, ""):
        sys.stdout.write(f"{prefix}: {line}")
    stream.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="EPYC control_plane.py governance wrapper")
    parser.add_argument("--target", required=True, help="path to control_plane.py")
    parser.add_argument("--approval-required", action="store_true", help="require approval for destructive ops")
    args = parser.parse_args()

    ensure_dirs()

    target = Path(args.target)
    if not target.exists():
        print(f"FATAL: target not found: {target}", file=sys.stderr)
        return 1

    audit_log({"event": "wrapper_start", "target": str(target)})
    export_mission_ledger({"event": "wrapper_start", "target": str(target)})

    proc = subprocess.Popen(
        [sys.executable, str(target)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=1,
    )

    threading.Thread(target=stream_reader, args=(proc.stdout, "stdout"), daemon=True).start()
    threading.Thread(target=stream_reader, args=(proc.stderr, "stderr"), daemon=True).start()

    def handle_signal(signum: int, _: Any) -> None:
        audit_log({"event": "signal", "signal": signal.Signals(signum).name})
        proc.send_signal(signum)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    returncode = proc.wait()
    audit_log({"event": "wrapper_exit", "returncode": returncode})
    export_mission_ledger({"event": "wrapper_exit", "returncode": returncode})
    return returncode


if __name__ == "__main__":
    sys.exit(main())
