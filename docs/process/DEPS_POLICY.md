# Dependency Policy — Integration Guide

`genx` consumes `@finografic/deps-policy` as its single source of truth for dependency versions.
Do not hardcode version strings in this repo — edit them in `deps-policy` and update the reference here.

---

## ## Getting started

`@finografic/deps-policy` is already wired as a dependency. During development it is referenced as a
local `file:` path. Before publishing a `genx` release, switch it to a proper semver reference.

### Current reference (development)

```json
"@finografic/deps-policy": "file:../_@finografic-deps-policy"
```

### Switching to a published version

Once `deps-policy` is published to GitHub Packages:

```bash
# Remove the file: entry from package.json, then:
pnpm add @finografic/deps-policy@<version>
```

Commit: `deps: pin deps-policy to <version>`

---

## ## Where versions are consumed

| File                                      | What it reads                                     |
| ----------------------------------------- | ------------------------------------------------- |
| `src/config/dependencies.rules.ts`        | `policy.base.devDependencies` — all migrate rules |
| `src/features/vitest/vitest.constants.ts` | `policy.base.devDependencies['vitest']`           |
| `src/commands/create.cli.ts`              | `policy.cli.dependencies['picocolors']`           |
| `src/commands/migrate.cli.ts`             | `policy.cli.dependencies['picocolors']`           |

---

## ## Ongoing: updating dependency versions

1. Edit the version in `deps-policy/src/policy/base.ts` (or the relevant type file).
2. Build and release `deps-policy` — see its [Release Process](../../_@finografic-deps-policy/docs/process/RELEASE_PROCESS.md).
3. In this repo: `pnpm update @finografic/deps-policy`
4. Run `pnpm typecheck && pnpm build` — must pass clean.
5. Commit: `deps: update deps-policy to <version>`

---

## ## Ongoing: adding a new package to the migrate rules

1. Add the package to `deps-policy/src/policy/base.ts` with its version.
2. Release `deps-policy`, update the reference here (step above).
3. Add a matching entry in `src/config/dependencies.rules.ts`:

```ts
{ name: 'new-package', version: dev['new-package'], section: 'devDependencies' },
```

4. Commit: `feat(deps): add new-package to migrate rules`

---

## ## Related documentation

| Doc                                                 | Purpose                   |
| --------------------------------------------------- | ------------------------- |
| [Release Process](./RELEASE_PROCESS.md)             | Versioning and publishing |
| [GitHub Packages Setup](./GITHUB_PACKAGES_SETUP.md) | Registry and token setup  |
