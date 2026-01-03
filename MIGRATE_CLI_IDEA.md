# MIGRATE CLI IDEA (Option A)

This doc captures the **deterministic “sync migrator”** approach for `@finografic/create` so multiple existing repos can be updated to the latest locked conventions with minimal effort and maximum repeatability.

---

## Goal

Add a new CLI command (e.g. `finografic-create migrate`) that can **apply the generator’s locked conventions** to an **existing** `@finografic/*` package.

Primary focus: **config surface area**, not business logic:

- `package.json` scripts + `lint-staged`
- `.simple-git-hooks.mjs`
- `.github/workflows/release.yml` (with repo-specific tokens preserved)
- `eslint.config.mjs`
- docs (`docs/*.md`)
- `.nvmrc`

---

## Option A: Deterministic “Sync” Migrator (chosen)

### Inputs

- **target directory** (defaults to `process.cwd()`)
- reads `target/package.json` to infer:
  - `name` → `@finografic/<pkg>`
  - `scope` → `@finografic` (default / expected)

### Safety / Confirmation

- If `package.json.name` is **not** in the form `@finografic/*`, prompt:
  - “Detected package name: … Continue? (Y/n)”
  - optionally allow edit of `scope` + `name`

### Behavior

- **Dry run by default**
  - prints a summarized plan (files to overwrite, JSON keys to patch)
- `--write` applies changes
- `--only` scopes to specific areas (e.g. `package-json,eslint,docs,workflows`)
- `--force` allows overwriting even if the file diverged from template

### Merge Rules (high-level)

- **Copy/overwrite** (template → repo) for “locked” files
  - safest default: overwrite for `docs/*`, `.simple-git-hooks.mjs`, `.nvmrc`
- **Patch/merge** for `package.json`
  - update known keys only (scripts, `lint-staged`, maybe `devDependencies` pins)
  - preserve repo-specific fields (name, version, deps, publishConfig access, keywords, etc.)
- **Keywords**
  - ensure `finografic` and the package name (e.g. `core`) exist in `keywords` (append near end if missing)

---

## Config Files (requested)

Implement config-driven behavior via:

- `src/config/migrate.config.ts`
  - allowlist/denylist of files
  - per-file strategy: `overwrite | merge | skip`
  - per-key patch rules for `package.json`
  - repo-specific invariants (what must never be overwritten)

---

## (Brief) Option B: Interactive Tree UI (parking note)

Revisit later if desired:

- Use [`clack-tree-select`](https://www.npmjs.com/package/clack-tree-select) to show a file-tree of planned changes
- Allow selecting which files to apply (some locked-required, some optional)
- Potentially add “view diff” per file (more work)
- Great UX, but more complexity and requires TTY; not ideal for automating across many repos
