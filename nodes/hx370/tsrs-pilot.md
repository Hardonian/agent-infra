# tsrs Pilot — HX370 (Milestone 7 / acceptance #8)

> Status: **EVALUATED — not adopted as a release gate.** Measured on HX370, 2026-10-26.
> Keep the established TypeScript compiler (`tsc`) authoritative for release.

## Package identity (verified)
- `tsrs` npm package, **v0.20.0-ts7.1.0-beta** (`latest` dist-tag; pre-1.0 **beta** maturity).
- Described as *"A Rust port of the TypeScript 7 compiler (tsc), language server, and JS API."*
  Self-reports `microsoft/TypeScript@3e92363` — i.e. the native TypeScript 7 port. This is the
  TypeScript compiler, **not** a similarly named Rust crate.
- Small native binary (~4.19 MB unpacked), Node >=16.20.

## Target repository (in-scope, version-compatible)
- `agent-infra/control-plane/packages/contracts` — TypeScript **^7.0.2**, `strict`, NodeNext,
  12 `.ts` files. Chosen because it is in integration scope **and** TS7-native (tsrs ports TS7).
- **Settler excluded:** it is a production SaaS repo on TypeScript **^6.0.3** — a different major
  version than the one tsrs ports, and not appropriate for disruptive benchmarking. (Real, but not
  a valid tsrs baseline.)
- Benchmark ran in an isolated scratch mirror (`~/.hermes/cache/scratch/tsrs-bench`) so the repo's
  `package.json`/lockfile were **not** modified. Same revision, equivalent `--noEmit` settings.

## Method
- `tsc` 7.0.2 vs `tsrs` 7.1.0-beta, both `--noEmit`, identical `tsconfig`.
- 1 warm-up discarded + **7 measured runs** each; median wall time; peak RSS via `/usr/bin/time -f %M`.
- Host: 16 CPUs, load ~0.26 (idle), no competing load. Power mode unknown (not exposed in WSL).

## Results (warm, 12-file package)
| Metric | tsc 7.0.2 | tsrs 7.1.0-beta | Δ |
|---|---|---|---|
| Median wall time | 0.093 s | **0.062 s** | tsrs ~33% faster |
| Peak RSS | ~70 MB | **~50 MB** | tsrs ~28% less |
| Diagnostics | 79 lines | 79 lines | **byte-for-byte identical** |
| Exit (clean code) | 0 | 0 | match |
| Exit (errors found) | 1 | **2** | **divergent** |

## Findings
1. **Diagnostics fidelity: excellent.** On the contracts package (79 lines of real errors) and on
   synthetic cases (config error `TS5108`, type error `TS2322`), tsrs output was **byte-for-byte
   identical** to tsc. It is a faithful TS7 port.
2. **Speed/memory: tsrs wins, but the baseline is small.** The package is startup-dominated, so the
   ~30 ms / ~20 MB advantage mostly reflects native-vs-Node startup, not compile throughput. A
   substantially larger TS7 repo would likely show a bigger absolute win — **untested** (no large
   in-scope TS7 repo; Settler is TS6/incompatible).
3. **Exit codes diverge (the one real integration hazard).** For "diagnostics found," tsc returns
   **1**, tsrs returns **2** (both return 0 on clean). Any CI gate that checks a *specific* nonzero
   code (rather than "nonzero = fail") would misread tsrs. **Normalize (map tsrs 2→1) before use.**
4. **TS7 compatibility note:** TypeScript 7 **removed** `moduleResolution: node`/`node10`
   (`TS5108: Option 'moduleResolution=node10' has been removed`). Relevant to any repo moving to TS7.
5. **Pre-existing failures (not caused by the pilot):** the contracts package itself currently has
   **79 lines of type errors** (zod v4 API-arity + a missing `crypto` import). This is a pre-existing
   condition, unrelated to tsrs, and means there was **no clean baseline** to justify release adoption.

## Decision
- **Do not wire tsrs into any release gate.** `tsc` remains authoritative.
- tsrs is compatible and measurably faster/lighter, but adoption is **not justified yet** because:
  (a) divergent exit code, (b) only a small, error-bearing in-scope TS7 package was available,
  (c) beta maturity.
- **Re-evaluate** on a substantially larger, **clean** TS7 repository. If a fast-feedback command is
  added later, gate it behind exit-code normalization and keep `tsc` as the release authority.
- No acceleration claim beyond these measured numbers; no repo lockfile/config was changed.
