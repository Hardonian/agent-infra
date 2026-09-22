# ControlPlane Execution Graph (Reality Mode)

## Nodes
- **ControlPlane**: Orchestrator CLI + SDK + verification workflows.
- **truthcore**: Knowledge/validation engine.
- **JobForge**: Job orchestration runner.
- **autopilot-suite**: Composite autopilot runners.
- **finops-autopilot**: Cost optimization runner.
- **ops-autopilot**: Ops automation runner.
- **growth-autopilot**: Growth automation runner.
- **support-autopilot**: Support automation runner.

## Edges (calls + callbacks)
| From | To | Mechanism | Command / API | Inputs | Outputs | Auth Context |
| --- | --- | --- | --- | --- | --- | --- |
| ControlPlane CLI | truthcore | CLI adapter | `node scripts/adapters/runner-adapter.mjs --runner truthcore --input <file> --out <path> --format json` | Golden input JSON | Report JSON | None (dry-run) |
| ControlPlane CLI | JobForge | CLI adapter | `node scripts/adapters/runner-adapter.mjs --runner JobForge --input <file> --out <path> --format json` | Golden input JSON | Report JSON | None (dry-run) |
| ControlPlane CLI | autopilot-suite | CLI adapter | `node scripts/adapters/runner-adapter.mjs --runner autopilot-suite --input <file> --out <path> --format json` | Golden input JSON | Report JSON | None (dry-run) |
| ControlPlane CLI | finops-autopilot | CLI adapter | `node scripts/adapters/runner-adapter.mjs --runner finops-autopilot --input <file> --out <path> --format json` | Golden input JSON | Report JSON | None (dry-run) |
| ControlPlane CLI | ops-autopilot | CLI adapter | `node scripts/adapters/runner-adapter.mjs --runner ops-autopilot --input <file> --out <path> --format json` | Golden input JSON | Report JSON | None (dry-run) |
| ControlPlane CLI | growth-autopilot | CLI adapter | `node scripts/adapters/runner-adapter.mjs --runner growth-autopilot --input <file> --out <path> --format json` | Golden input JSON | Report JSON | None (dry-run) |
| ControlPlane CLI | support-autopilot | CLI adapter | `node scripts/adapters/runner-adapter.mjs --runner support-autopilot --input <file> --out <path> --format json` | Golden input JSON | Report JSON | None (dry-run) |
| ControlPlane SDK | Any runner | SDK | `ControlPlaneClient.runRunner({ runner, input, outputPath })` | Input JSON | Report JSON | Optional env vars |
| GitHub Actions | ControlPlane | Workflow call | `verify-integrations.yml` | Repo context + fixtures | Integration reports | `GITHUB_TOKEN` (read) |

## Required environment variables (names only)
- `CONTROLPLANE_OFFLINE` (optional: skip external clone attempts)
- `GITHUB_TOKEN` (read-only for workflow access)

## Expected artifacts
- `test-results/<runner>-report.json`
- `docs/reality/REPO_SCAN_MATRIX.md`
- `docs/reality/EXECUTION_GRAPH.md`
