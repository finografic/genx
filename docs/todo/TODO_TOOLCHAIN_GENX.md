# TODO — Toolchain Version Consumption in genx

> **Status:** Not started. Policy-side work complete (2026-05-26). Genx integration pending.

This document specifies what `@finografic/genx` needs to do to consume the new `toolchain` export from `@finografic/deps-policy`. It is a handoff spec from the policy repo.

---

## Context

`@finografic/deps-policy` now exports a `toolchain` object alongside `policy`:

```ts
import { toolchain } from '@finografic/deps-policy';

toolchain.node; // '24.3.0'  — bare semver, no prefix
toolchain.pnpm; // '10.32.1' — bare semver, no prefix
```

These are **not** npm packages. They cannot be applied via `pnpm add`. Each has its own distinct write target and format in a target project.

---

## What genx needs to add

### 1. Import `toolchain`

In `src/config/dependencies.rules.ts` (or a new sibling file like `toolchain.rules.ts`), import:

```ts
import { toolchain } from '@finografic/deps-policy';
```

### 2. Node version — two writes

When running `genx deps` or `genx create` on a target project:

| Target file                     | Value                   | Example    |
| ------------------------------- | ----------------------- | ---------- |
| `.nvmrc`                        | `toolchain.node` + `\n` | `24.3.0\n` |
| `package.json` → `engines.node` | `>=` + `toolchain.node` | `>=24.3.0` |

Both are simple file/JSON writes. No install step.

### 3. pnpm version — one write

| Target file                       | Value                      | Example        |
| --------------------------------- | -------------------------- | -------------- |
| `package.json` → `packageManager` | `pnpm@` + `toolchain.pnpm` | `pnpm@10.32.1` |

Single JSON field write. No install step.

---

## Update flow summary

The three update paths in `genx deps` / `genx create`:

| Source                      | Mechanism           | Target                                   |
| --------------------------- | ------------------- | ---------------------------------------- |
| `policy.base` + `policy[t]` | `pnpm add -D p@ver` | `package.json` dependencies              |
| `toolchain.node`            | file write          | `.nvmrc` + `package.json` `engines.node` |
| `toolchain.pnpm`            | JSON field write    | `package.json` `packageManager`          |

Package deps use `pnpm add`. Toolchain versions use direct file mutations. These are independent operations that can run in any order.

---

## Progress

- [x] Policy-side: `ToolchainPolicy` type, `toolchain` export, snapshot inclusion, docs
- [ ] Genx: import `toolchain` from deps-policy
- [ ] Genx: write `.nvmrc` with `toolchain.node`
- [ ] Genx: set `engines.node` to `>=toolchain.node` in target `package.json`
- [ ] Genx: set `packageManager` to `pnpm@toolchain.pnpm` in target `package.json`
- [ ] Genx: integrate into `genx deps` command flow
- [ ] Genx: integrate into `genx create` scaffold flow
