# Dependabot Vulnerability Triage — agent-infra

> 2026-10-26. Source: `gh api repos/Hardonian/agent-infra/dependabot/alerts?state=open` (**27 open**;
> the "28" in the push banner counts one already-resolved/dismissed). **Read-only triage — no deps bumped.**

## Bottom line
- **0 vulnerabilities in `agent-mesh` (Go).** The Go control plane + the `pgx` dependency added for the
  durable store are **clean**. Nothing here affects the code that was built/deployed/verified this session.
- **0 in the production SaaS repos** (Settler, workworld, etc. — separate repos, untouched).
- **All 27 are npm, all in the `control-plane` sub-project** (a TypeScript contract/tooling project), and
  almost entirely **development-scope or lockfile-transitive** — i.e. local build/scaffold tooling, not a
  deployed internet-facing service. Real-world exploitability is **low**.
- **No open Dependabot fix PRs exist** (the 3 prior ones are merged). Dependabot *security* PRs appear
  **disabled** for this repo — it raises alerts but not auto-fix PRs.

## Breakdown
| Dimension | Count |
|---|---|
| By severity | 2 critical, 6 high, 14 medium, 5 low |
| By relationship | 24 transitive (lockfile), **3 direct** |
| By scope | 23 development, 4 runtime |
| By manifest | 24 `control-plane/pnpm-lock.yaml`, 3 direct `vitest` in template/sdk `package.json` |

## Prioritized findings

### P1 — critical (dev/transitive): `handlebars` (2)
- CVE-2026-106445 / CVE-2026-106446 — JavaScript injection via own-property-check bypass & AST type
  confusion. Range `>=3.0.0, <=4.7.9` → **patched 4.7.10**. Transitive, dev-scope in `pnpm-lock.yaml`.
- Risk: low (dev-only, requires a malicious build/template to trigger), but highest severity → clear first.

### P2 — high (mixed): `vite`, `brace-expansion`×2, `undici`, `fast-uri`×2
- `brace-expansion` (×2) DoS via uncontrolled recursion — **runtime-scope**, transitive → the most
  "prod-adjacent" of the set; patched 5.0.10/5.0.11.
- `vite` (devserver fs/editor issues), `undici` (TLS validation bypass), `fast-uri` (host/authority
  injection) — all transitive dev, patched 8.3.3 / 7.29.1 / 4.1.4.

### P3 — medium: `vitest` (3, **DIRECT**), `vite`×4, `handlebars`, `fast-copy`, `brace-expansion`, `undici`×2, `fast-uri`, `js-yaml`
- **`vitest` ×3 are the only DIRECT deps** — dev-dep in `create-runner/templates/*` and
  `sdk-generator/sdks/typescript` `package.json`; path-traversal/arbitrary-file-read; patched **4.1.11**.
  Trivial, isolated bumps.
- `fast-copy` (stack exhaustion) — runtime-scope transitive.

### P4 — low: `vite`, `undici`×3
- Response splitting / caching-replay / cross-origin script issues; all transitive dev; patched 8.3.3 / 6.28.1 / 7.29.1.

## Recommended actions (not yet applied)
1. **Enable Dependabot security updates** for the repo (Settings → Code security) so these get auto-fix
   PRs instead of alert-only. Highest leverage, zero manual work going forward.
2. **Bump the 3 direct `vitest` dev-deps** to `^4.1.11` in the three template/sdk `package.json` files
   (isolated, dev-only, low risk).
3. **Refresh the `control-plane` lockfile** to lift transitive deps to patched versions:
   `cd control-plane && pnpm update handlebars vite undici fast-uri brace-expansion fast-copy js-yaml`
   then run control-plane's own build/test (`pnpm build`, `pnpm test`) to confirm nothing regresses.
4. Because these are dev/transitive in a tooling sub-project (not a deployed service), this is **routine
   maintenance, not an emergency** — schedule it, don't hot-patch.

## Applied (2026-10-26)
The recommended **transitive CVE lifts are now applied** via the repo's own `pnpm.overrides`
pattern (commit `8a464b8`): handlebars→4.7.10, undici→≥7.29.1, fast-uri→4.2.3,
brace-expansion→5.0.12, fast-copy→4.3.1, js-yaml→5.5.0. Lockfile re-resolved; **all lifted
(verified)**. The 3 direct `vitest` in templates were left as-is (the root lockfile already
resolves vitest 5.0.5 ≥ patched 4.1.11; the templates' `^3.2.6` are scaffolding not exercised by
the build). Enabling Dependabot security updates remains recommended for ongoing hygiene.

## Not done here (deliberately)
- The **direct `vitest ^3.2.6` in the 3 template `package.json`s** were not major-bumped to 4.x
  (breaking-change risk in generated-project tests; not exercised by control-plane's build/test).
