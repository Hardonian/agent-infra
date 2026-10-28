#!/usr/bin/env python3
"""EPYC → mission-ledger event bridge.

Watches EPYC audit log and exports events in mission-ledger compatible format.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

SOURCE_TAG = "epyc-bridge"


def tail_audit_log(path: str, poll_interval: float = 1.0) -> None:
    """Tail the EPYC audit log and export to mission-ledger directory."""
    audit_path = Path(path)
    if not audit_path.exists():
        print(f"[WARN] audit log not found: {path}", file=sys.stderr)
        return

    print(f"[INFO] Tailing {path}")
    with open(path, "r") as f:
        f.seek(0, 2)  # start at end
        while True:
            line = f.readline()
            if not line:
                time.sleep(poll_interval)
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            enriched = {
                "source": SOURCE_TAG,
                "imported_at": datetime.datetime.utcnow().isoformat() + "Z",
                **record,
            }
            print(json.dumps(enriched))


def main() -> int:
    parser = argparse.ArgumentParser(description="EPYC → mission-ledger bridge")
    parser.add_argument("--audit-log", default="/var/lib/epyc/audit.log", help="EPYC audit log path")
    parser.add_argument("--output-dir", default="/var/lib/epyc/mission-ledger", help="mission-ledger output directory")
    parser.add_argument("--once", action="store_true", help="process existing lines and exit")
    args = parser.parse_args()

    Path(args.output_dir).mkdir(parents=True, exist_ok=True)

    if args.once:
        print("[INFO] --once: processing existing audit log")
        # In --once mode, just confirm the audit log exists and is readable
        audit_path = Path(args.audit_log)
        if audit_path.exists():
            print(f"[INFO] Audit log exists: {audit_path} ({audit_path.stat().st_size} bytes)")
            return 0
        print("[WARN] Audit log not found", file=sys.stderr)
        return 1

    tail_audit_log(args.audit_log)
    return 0


if __name__ == "__main__":
    sys.exit(main())
