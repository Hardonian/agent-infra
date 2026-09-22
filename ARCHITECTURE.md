# agent-infra — Architecture

> Part of the [Hardonia Platform](https://github.com/Hardonian/Hardonian).

## Position in the Platform

```
┌─────────────────────────────────────────────────────────────────┐
│                        HARDONIA PLATFORM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  AUTOPILOT   │  │ AGENT-INFRA │  │ AGENT-EDGE  │             │
│  │             │  │ ◄── THIS    │  │             │             │
│  │  ops/       │  │ control-    │  │ mesh-edge/  │             │
│  │  finops/    │  │  plane/     │  │ pcap/       │             │
│  │  growth/    │  │ mission-    │  │             │             │
│  │  support/   │  │  ledger/    │  └──────┬──────┘             │
│  │             │  │ agent-mesh/ │         │                    │
│  └─────────────┘  │ mcpwall/    │         │                    │
│                   └──────┬──────┘         │                    │
│                          │                │                    │
│                          └────────────────┘                    │
│                    ┌─────▼─────┐                               │
│                    │ MODEL-    │                               │
│                    │ TOOLS     │                               │
│                    └───────────┘                               │
├─────────────────────────────────────────────────────────────────┤
│  COMMERCIAL LAYER                                               │
│  hardonia-store · comfyui-workflow-packs · content-repo          │
└─────────────────────────────────────────────────────────────────┘
```

## What agent-infra does

The execution and governance backbone of the Hardonia platform:

| Component | Language | Role |
|---|---|---|
| **control-plane** | TypeScript | Contract-first ecosystem for ControlPlane-compatible services |
| **mission-ledger** | Go / TypeScript | Governed agent execution with deterministic policy and proofpacks |
| **agent-mesh** | Go | Open control plane for A2A/MCP agents — identity, routing, delivery |
| **mcpwall** | Rust | Local-first MCP policy firewall and audit proxy |

## Dependencies on sibling repos

| Dependency | Via | What it provides |
|---|---|---|
| [autopilot](https://github.com/Hardonian/autopilot) | ops, finops | Job requests and cost events consumed by control-plane and mission-ledger |
| [agent-edge](https://github.com/Hardonian/agent-edge) | mesh-edge | Edge networking for agent-mesh routing |
| [model-tools](https://github.com/Hardonian/model-tools) | ollama-router | GPU routing for inference workloads managed by control-plane |

## Internal dependencies

```
control-plane ──→ mission-ledger  (governance records)
control-plane ──→ agent-mesh  (routing via mesh)
mcpwall ──→ agent-mesh  (MCP routing)
```

## Sibling repos

- [autopilot](https://github.com/Hardonian/autopilot) — ops, finops, growth, support
- [agent-edge](https://github.com/Hardonian/agent-edge) — mesh-edge, pcap
- [model-tools](https://github.com/Hardonian/model-tools) — model-forge, inference-api, ollama-router
