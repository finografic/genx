# TODO — Migrate genx to @finografic/cli-kit

> **Status:** Phase 1 complete (2026-04-20). Phase 2 not started.

Replace genx's inline `src/core/` copies with `@finografic/cli-kit` subpath imports, then update features so generated/migrated projects also depend on cli-kit rather than carrying local `core/` copies.

---

## Phase 1 — Migrate genx's own `src/` (not `_templates`)

- [x] Install `@finografic/cli-kit` (was already a dep at `^0.2.2`)
- [x] Swap `core/flow` → `@finografic/cli-kit/flow` (8 import sites + `feature-preview` relative imports)
- [x] Swap `core/render-help` → `@finografic/cli-kit/render-help` (8 import sites)
- [x] Swap `core/file-diff` → `@finografic/cli-kit/file-diff` (`migrate.cli.ts` + `feature-preview.utils.ts` + `feature-preview.test.ts`)
- [x] Migrate XDG path in `src/utils/managed.utils.ts` → `getConfigPath('genx')` from `cli-kit/xdg`
- [x] Remove `core/*` path alias from `tsconfig.json`
- [x] Delete `src/core/flow/`, `src/core/render-help/`, `src/core/file-diff/` (keep `src/core/self-update/`)
- [x] `pnpm typecheck` — zero errors
- [ ] Commit `refactor: migrate core primitives to @finografic/cli-kit`

## Phase 2 — Adjust features to use cli-kit in generated/migrated output

- [ ] Audit `create` command + `_templates/package.json` — add `@finografic/cli-kit` as a generated dep
- [ ] Update `_templates/` skeleton `src/` imports to use `cli-kit/*` subpaths (if any still reference `core/`)
- [ ] Audit `migrate` features — any that write `src/core/flow/` or `src/core/render-help/` into targets should instead inject `@finografic/cli-kit` dep and rewrite imports
- [ ] Update `migrate-to-cli-kit` skill if the procedure changes as a result
- [ ] `pnpm typecheck` — zero errors
- [ ] Commit `feat: features inject @finografic/cli-kit instead of src/core/ copies`

---

## Notes

- `src/core/self-update/` is genx-specific — stays in `src/core/`, is not migrated
- `_templates/` is the only source of truth for generated output; Phase 1 touches only `src/`
- cli-kit version at migration start: `0.2.2`
