#!/usr/bin/env python3
"""Lightweight MCP firewall proxy for local MCP servers.

Inspired by agent-infra/mcpwall. Validates JSON-RPC requests against a
simple TOML policy before forwarding to the upstream MCP server.
"""

from __future__ import annotations

import argparse
import hashlib
import http.server
import json
import os
import sys
from pathlib import Path
from typing import Any

POLICY_PATH = os.getenv("MCPWALL_POLICY", "/home/scott/ai-workspace/repos/agent-infra/mcpwall/policy.toml")
ALLOWED_METHODS = {"tools/list", "tools/call", "initialize", "shutdown"}
MAX_BODY_BYTES = 1 << 20  # 1 MiB


def load_policy() -> dict[str, Any]:
    path = Path(POLICY_PATH)
    if not path.exists():
        return {"allowed_methods": list(ALLOWED_METHODS), "blocked_methods": []}
    # Minimal TOML parse without tomli dependency
    text = path.read_text()
    policy: dict[str, Any] = {"allowed_methods": list(ALLOWED_METHODS), "blocked_methods": []}
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("allowed_methods"):
            methods = line.split("=", 1)[1].strip().strip("[]").replace('"', "").replace("'", "").split(",")
            policy["allowed_methods"] = [m.strip() for m in methods if m.strip()]
        if line.startswith("blocked_methods"):
            methods = line.split("=", 1)[1].strip().strip("[]").replace('"', "").replace("'", "").split(",")
            policy["blocked_methods"] = [m.strip() for m in methods if m.strip()]
    return policy


class MCPWallProxy(http.server.HTTPServer):
    def __init__(self, server_address: tuple[str, int], upstream: str, policy: dict[str, Any]):
        super().__init__(server_address, MCPWallHandler)
        self.upstream = upstream
        self.policy = policy


class MCPWallHandler(http.server.BaseHTTPRequestHandler):
    server: MCPWallProxy  # type: ignore[assignment]

    def do_POST(self) -> None:  # noqa: N802
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > MAX_BODY_BYTES:
            self.send_error(413, "Request body too large")
            return

        body = self.rfile.read(content_length)
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        method = payload.get("method", "")
        if method in self.server.policy.get("blocked_methods", []):
            self.send_error(403, f"Blocked by policy: {method}")
            return

        allowed = self.server.policy.get("allowed_methods", [])
        if allowed and method not in allowed:
            self.send_error(403, f"Method not allowed: {method}")
            return

        # Forward upstream
        import urllib.request
        req = urllib.request.Request(
            self.server.upstream,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                self.send_response(resp.status)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(resp.read())
        except Exception as exc:
            self.send_error(502, f"Upstream error: {exc}")

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        sys.stdout.write(f"[mcpwall] {format % args}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="MCP firewall proxy")
    parser.add_argument("--listen", default="127.0.0.1:9214", help="listen address")
    parser.add_argument("--upstream", default="http://127.0.0.1:35081", help="upstream MCP server")
    parser.add_argument("--policy", default=POLICY_PATH, help="policy TOML path")
    args = parser.parse_args()

    host, port = args.listen.split(":")
    policy = load_policy()
    server = MCPWallProxy((host, int(port)), args.upstream, policy)

    print(f"[INFO] mcpwall listening on {args.listen} → {args.upstream}")
    print(f"[INFO] policy: {len(policy.get('allowed_methods', []))} allowed, {len(policy.get('blocked_methods', []))} blocked")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] shutting down")
    return 0


if __name__ == "__main__":
    sys.exit(main())
