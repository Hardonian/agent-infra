# agent-infra

**Unified agent infrastructure: execution engine, policy governance, mesh networking, and MCP firewall.**

A monorepo consolidating the Hardonian agent infrastructure stack into a single repository.

## Components

| Directory | Language | Description |
|---|---|---|
| [`control-plane/`](control-plane/) | TypeScript | Contract-first ecosystem for ControlPlane-compatible services. Ships Zod schemas, validation CLIs, runner scaffolding, and compatibility tooling. |
| [`mission-ledger/`](mission-ledger/) | Go / TypeScript | Governed agent execution substrate with deterministic policy, explicit approvals, budget enforcement, and exportable proofpacks. |
| [`agent-mesh/`](agent-mesh/) | Go | Open control plane for A2A and MCP agents — identity, policy, routing, reliability, and progressive delivery. |
| [`mcpwall/`](mcpwall/) | Rust | Local-first policy firewall and audit proxy for MCP stdio servers. Validates every JSON-RPC request against an inspectable TOML policy. |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    agent-infra                       │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ control-plane │  │ mission-     │                 │
│  │ (contracts,   │  │ ledger       │                 │
│  │  schemas,     │  │ (governance, │                 │
│  │  tooling)     │  │  policy,     │                 │
│  └──────────────┘  │  approvals)  │                 │
│                     └──────────────┘                 │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ agent-mesh   │  │ mcpwall      │                 │
│  │ (routing,    │  │ (MCP         │                 │
│  │  identity,   │  │  firewall,   │                 │
│  │  A2A/MCP)    │  │  audit)      │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
```

## Getting Started

Each component has its own build system and documentation:

- **ControlPlane** (TypeScript): `cd control-plane && npm install`
- **MissionLedger** (Go): `cd mission-ledger && go build ./...`
- **AgentMesh** (Go): `cd agent-mesh && go build ./...`
- **mcpwall** (Rust): `cd mcpwall && cargo build`

See each component's `README.md` for detailed setup and usage instructions.


## Related Repos

### Platform Monorepos
- [autopilot](https://github.com/Hardonian/autopilot) — ops, finops, growth, support
- [agent-edge](https://github.com/Hardonian/agent-edge) — mesh-edge, pcap
- [model-tools](https://github.com/Hardonian/model-tools) — model-forge, inference-api, ollama-router

### Commercial
- [hardonia-store](https://github.com/Hardonian/hardonia-store) — storefront
- [comfyui-workflow-packs](https://github.com/Hardonian/comfyui-workflow-packs) — ComfyUI workflow products
- [content-repo](https://github.com/Hardonian/content-repo) — blog posts and email sequences

## License

Each component retains its original license. See individual `LICENSE` files for details.