# TODO: Command Folder Restructure

**Status:** DONE

Align `src/commands/` with the established pattern used in `_@finografic-deps-policy/src/deps-cli/`:

- Each command gets its own subfolder `commands/{name}/`
- Help is co-located as `{name}.help.ts`
- Help uses `withHelp()` wrapper (not manual `--help` check + `renderHelp()`)
- Exclusive `src/lib/` logic moves into the command folder under a `lib/` subfolder

---

## Reference Pattern

**Source:** `_@finografic-deps-policy/src/deps-cli/commands/outdated/`

```
commands/outdated/
  outdated.cli.ts   ← withHelp(argv, help, async () => { ... })
  outdated.help.ts  ← CommandHelpConfig (not HelpConfig)
```

---

## Exclusivity Analysis

### Files that MOVE into command folders

**audit exclusive:**

- `src/lib/audit/audit.ts` → `src/commands/audit/lib/audit.ts`
- `src/lib/prompts/audit.prompt.ts` → `src/commands/audit/lib/audit.prompt.ts`

**migrate exclusive** (migrate-metadata.utils stays in lib — imported by shared `package-json.utils.ts`):

- `src/lib/migrate/agent-docs-migration.ts` → `src/commands/migrate/lib/agent-docs-migration.ts`
- `src/lib/migrate/docs-restructure.utils.ts` → `src/commands/migrate/lib/docs-restructure.utils.ts`
- `src/lib/migrate/merge.utils.ts` → `src/commands/migrate/lib/merge.utils.ts`
- `src/lib/migrate/node.utils.ts` → `src/commands/migrate/lib/node.utils.ts`
- `src/lib/migrate/plan.utils.ts` → `src/commands/migrate/lib/plan.utils.ts`
- `src/lib/migrate/rename.utils.ts` → `src/commands/migrate/lib/rename.utils.ts`
- `src/lib/migrate/template-sync.utils.ts` → `src/commands/migrate/lib/template-sync.utils.ts`
- `src/lib/prompts/migrate.prompt.ts` → `src/commands/migrate/lib/migrate.prompt.ts`

### Files that STAY in src/lib/ (shared across commands)

- `src/lib/migrate/dependencies.utils.ts` — used by `deps` + `migrate`
- `src/lib/migrate/dependencies.utils.test.ts` — stays with module
- `src/lib/migrate/package-json.utils.ts` — used by `audit`, `deps`, `migrate`, git-hooks feature
- `src/lib/migrate/migrate-metadata.utils.ts` — used by `package-json.utils.ts` (shared!) + migrate lib files
- `src/lib/prompts/features.prompt.ts` — used by `features` + `migrate`
- `src/lib/prompts/managed.prompt.ts` — used by `deps`, `features`, `migrate`
- `src/lib/prompts/author.prompt.ts` — used via `utils/prompts.ts`
- `src/lib/prompts/package-manifest.prompt.ts` — used via `utils/prompts.ts`
- `src/lib/prompts/package-type.prompt.ts` — used via `utils/prompts.ts`

---

## Tasks

### Phase 1 — Create command subfolders & move .cli.ts files

- [x] Create `src/commands/audit/` and move `audit.cli.ts` into it
- [x] Create `src/commands/create/` and move `create.cli.ts` into it
- [x] Create `src/commands/deps/` and move `deps.cli.ts` into it
- [x] Create `src/commands/features/` and move `features.cli.ts` into it
- [x] Create `src/commands/migrate/` and move `migrate.cli.ts` into it
- [x] Update `src/cli.ts` imports (e.g. `./commands/audit.cli.js` → `./commands/audit/audit.cli.js`)

### Phase 2 — Move and convert help files

- [x] Move `src/help/audit.help.ts` → `src/commands/audit/audit.help.ts`
  - Convert `HelpConfig` → `CommandHelpConfig`
  - Export as `help` (not `auditHelp`) to match reference pattern
- [x] Move `src/help/create.help.ts` → `src/commands/create/create.help.ts`
  - Convert `HelpConfig` → `CommandHelpConfig`
  - Export as `help`
- [x] Move `src/help/deps.help.ts` → `src/commands/deps/deps.help.ts`
  - Convert `HelpConfig` → `CommandHelpConfig`
  - Export as `help`
- [x] Move `src/help/features.help.ts` → `src/commands/features/features.help.ts`
  - Convert `HelpConfig` → `CommandHelpConfig`
  - Export as `help`
- [x] Move `src/help/migrate.help.ts` → `src/commands/migrate/migrate.help.ts`
  - Convert `HelpConfig` → `CommandHelpConfig`
  - Export as `help`
- [x] Delete empty `src/help/` folder
- [x] Remove `"help/*": ["./src/help/*"]` path alias from `tsconfig.json`

### Phase 3 — Switch to withHelp wrapper in each command

Each command currently has:

```ts
if (argv.includes('--help') || argv.includes('-h')) {
  renderHelp(xyzHelp);
  return;
}
```

Replace with `withHelp(argv, help, async () => { ... })` pattern.

- [x] `audit.cli.ts` — wrap `auditPackage` body in `withHelp`
- [x] `create.cli.ts` — wrap `createPackage` body in `withHelp`
- [x] `deps.cli.ts` — wrap `syncDeps` body in `withHelp`
- [x] `features.cli.ts` — wrap `addFeatures` body in `withHelp` (note: `applyFeaturesToTarget` is a separate export, not wrapped)
- [x] `migrate.cli.ts` — wrap `migratePackage` body in `withHelp`

### Phase 4 — Move audit-exclusive lib files

- [x] Create `src/commands/audit/lib/`
- [x] Move `src/lib/audit/audit.ts` → `src/commands/audit/lib/audit.ts`
  - Update imports in `audit.cli.ts`
- [x] Move `src/lib/prompts/audit.prompt.ts` → `src/commands/audit/lib/audit.prompt.ts`
  - Update imports in `audit.cli.ts`
- [x] Delete empty `src/lib/audit/` folder

### Phase 5 — Move migrate-exclusive lib files

- [x] Create `src/commands/migrate/lib/`
- [x] Move `src/lib/migrate/agent-docs-migration.ts` → `src/commands/migrate/lib/agent-docs-migration.ts`
- [x] Move `src/lib/migrate/docs-restructure.utils.ts` → `src/commands/migrate/lib/docs-restructure.utils.ts`
  - Update internal imports: `lib/prompts/migrate.prompt` → `./migrate.prompt.js`
  - Update internal imports: `lib/migrate/migrate-metadata.utils` → `lib/migrate/migrate-metadata.utils` (stays)
- [x] Move `src/lib/migrate/merge.utils.ts` → `src/commands/migrate/lib/merge.utils.ts`
- [x] Move `src/lib/migrate/node.utils.ts` → `src/commands/migrate/lib/node.utils.ts`
- [x] Move `src/lib/migrate/plan.utils.ts` → `src/commands/migrate/lib/plan.utils.ts`
  - Update internal imports: relative paths to lib files that moved
- [x] Move `src/lib/migrate/rename.utils.ts` → `src/commands/migrate/lib/rename.utils.ts`
- [x] Move `src/lib/migrate/template-sync.utils.ts` → `src/commands/migrate/lib/template-sync.utils.ts`
  - Update internal imports: `lib/migrate/migrate-metadata.utils` → stays as-is (path alias still works)
- [x] Move `src/lib/prompts/migrate.prompt.ts` → `src/commands/migrate/lib/migrate.prompt.ts`
- [x] Update all imports in `migrate.cli.ts` (many `lib/migrate/` → `./lib/`)
- [x] Verify `src/lib/migrate/` only contains: `dependencies.utils.ts`, `dependencies.utils.test.ts`, `package-json.utils.ts`, `migrate-metadata.utils.ts`

### Phase 6 — Verify & cleanup

- [x] `pnpm typecheck` passes
- [x] `pnpm test` passes
- [x] `pnpm build` passes
- [x] Verify no stale imports remain pointing to old paths
- [x] Check `src/lib/prompts/` — if `audit.prompt.ts` and `migrate.prompt.ts` are moved, verify remaining files

---

## Import Map (for reference during implementation)

### src/cli.ts changes

```
./commands/audit.cli.js    → ./commands/audit/audit.cli.js
./commands/create.cli.js   → ./commands/create/create.cli.js
./commands/deps.cli.js     → ./commands/deps/deps.cli.js
./commands/features.cli.js → ./commands/features/features.cli.js
./commands/migrate.cli.js  → ./commands/migrate/migrate.cli.js
```

### audit.cli.ts import changes

```
'help/audit.help'                  → './audit.help.js'
'../lib/audit/audit.js'            → './lib/audit.js'
'../lib/prompts/audit.prompt.js'   → './lib/audit.prompt.js'
```

### migrate.cli.ts import changes (lib moves)

```
'lib/migrate/agent-docs-migration'  → './lib/agent-docs-migration.js'
'lib/migrate/docs-restructure.utils' → './lib/docs-restructure.utils.js'
'lib/migrate/merge.utils'           → './lib/merge.utils.js'
'lib/migrate/migrate-metadata.utils' → './lib/migrate-metadata.utils.js' (STAYS in lib/migrate/ — use path alias or relative path up)
'lib/migrate/node.utils'            → './lib/node.utils.js'
'lib/migrate/plan.utils'            → './lib/plan.utils.js'
'lib/migrate/rename.utils'          → './lib/rename.utils.js'
'lib/migrate/template-sync.utils'   → './lib/template-sync.utils.js'
'lib/prompts/migrate.prompt'        → './lib/migrate.prompt.js'
'help/migrate.help'                 → './migrate.help.js'
```

Note: `dependencies.utils`, `package-json.utils` keep their `lib/migrate/*` path aliases (stay in src/lib/).

### docs-restructure.utils.ts import changes

```
'lib/prompts/migrate.prompt'       → './migrate.prompt.js'
'lib/migrate/migrate-metadata.utils' → 'lib/migrate/migrate-metadata.utils' (stays)
```

### plan.utils.ts import changes

```
'lib/migrate/node.utils'     → './node.utils.js'
'lib/migrate/rename.utils'   → './rename.utils.js'
'lib/migrate/package-json.utils' → 'lib/migrate/package-json.utils' (stays)
'lib/migrate/dependencies.utils' → 'lib/migrate/dependencies.utils' (stays)
'lib/migrate/merge.utils'    → './merge.utils.js'
'lib/migrate/migrate-metadata.utils' → 'lib/migrate/migrate-metadata.utils' (stays)
```

### template-sync.utils.ts import changes

```
'lib/migrate/migrate-metadata.utils' → 'lib/migrate/migrate-metadata.utils' (stays)
```
