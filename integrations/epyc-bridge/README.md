# agent-infra ↔ EPYC Bridge

Lightweight Python bridge that wraps the existing EPYC `control_plane.py` with
agent-infra governance, policy enforcement, and MCP firewall proxying.

## Components

- `control_plane_wrapper.py` — wraps the existing control_plane.py with governance hooks
- `mission_ledger_bridge.py` — exports EPYC events to mission-ledger format
- `mcpwall_proxy.py` — lightweight MCP firewall proxy for local MCP servers

## Setup

```bash
# Wrap existing control_plane.py
python3 control_plane_wrapper.py --target /home/scott/ai-lab/platform/control_plane.py

# Export events to mission-ledger
python3 mission_ledger_bridge.py --output /var/lib/epyc/mission-ledger/

# Start MCP firewall proxy
python3 mcpwall_proxy.py --listen 127.0.0.1:9214 --upstream 127.0.0.1:35081
```
