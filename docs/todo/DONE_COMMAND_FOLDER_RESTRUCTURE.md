# DONE — Command Folder Restructure

> **Completed:** 2026-05-26

Align `src/commands/` with the established pattern used in `@finografic-deps-policy/src/deps-cli/`:

- Each gets its own subfolder `commands/{name}/`
- Help is co-located as `{name}.help.ts`
- Help uses `withHelp()` wrapper (not manual `--help` check + `renderHelp()`)
- Exclusive `src/lib/` logic moves into the folder under a `lib/` subfolder

---

## Reference Pattern

**Source:** `@finografic-deps-policy/src/deps-cli/commands/outdated/`

```
commands/outdated/
  outdated.cli.ts   ← withHelp(argv, help, async () => { ... })
  outdated.help.ts  ← CommandHelpConfig (not HelpConfig)
```

---

## Exclusivity Analysis

### Files that MOVE into folders

**audit exclusive:**

- `src/lib/audit/audit.ts` → `src/commands/audit/lib/audit.ts`
- `src/lib/prompts/audit.prompt.ts` → `src/commands/audit/lib/audit.prompt.ts`

**upgrade exclusive** (upgrade-metadata.utils stays in lib — imported by shared `package-json.utils.ts`):

- `src/lib/package-policy/agent-docs-migration.ts` → `src/commands/upgrade/lib/agent-docs-migration.ts`
- `src/lib/package-policy/docs-restructure.utils.ts` → `src/commands/upgrade/lib/docs-restructure.utils.ts`
- `src/lib/package-policy/merge.utils.ts` → `src/commands/upgrade/lib/merge.utils.ts`
- `src/lib/package-policy/node.utils.ts` → `src/commands/upgrade/lib/node.utils.ts`
- `src/lib/package-policy/plan.utils.ts` → `src/commands/upgrade/lib/plan.utils.ts`
- `src/lib/package-policy/rename.utils.ts` → `src/commands/upgrade/lib/rename.utils.ts`
- `src/lib/package-policy/template-sync.utils.ts` → `src/commands/upgrade/lib/template-sync.utils.ts`
- `src/commands/upgrade/lib/upgrade.prompt.ts` → `src/commands/upgrade/lib/upgrade.prompt.ts`

### Files that STAY in src/lib/ (shared acrosss)

- `src/lib/package-policy/dependencies.utils.ts` — used by `deps` + `upgrade`
- `src/lib/package-policy/dependencies.utils.test.ts` — stays with module
- `src/lib/package-policy/package-json.utils.ts` — used by `audit`, `deps`, `upgrade`, git-hooks feature
- `src/commands/upgrade/lib/upgrade-metadata.utils.ts` — used by upgrade lib files
- `src/lib/prompts/features.prompt.ts` — used by feature and upgrade flows`
- `src/lib/prompts/managed.prompt.ts` — used by managed flows`
- `src/lib/prompts/author.prompt.ts` — used via `utils/prompts.ts`
- `src/lib/prompts/package-manifest.prompt.ts` — used via `utils/prompts.ts`
- `src/lib/prompts/package-type.prompt.ts` — used via `utils/prompts.ts`

---

## Tasks

### Phase 1 — Create subfolders & move .cli.ts files

- [x] Create `src/commands/audit/` and move `audit.cli.ts` into it
- [x] Create `src/commands/create/` and move `create.cli.ts` into it
- [x] Create `src/commands/deps/` and move `deps.cli.ts` into it
- [x] Create `src/commands/features/` and move `features.cli.ts` into it
- [x] Create `src/commands/upgrade/` and move `upgrade.cli.ts` into it
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
- [x] Move `src/help/upgrade.help.ts` → `src/commands/upgrade/upgrade.help.ts`
  - Convert `HelpConfig` → `CommandHelpConfig`
  - Export as `help`
- [x] Delete empty `src/help/` folder
- [x] Remove `"help/*": ["./src/help/*"]` path alias from `tsconfig.json`

### Phase 3 — Switch to withHelp wrapper in each

Each currently has:

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
- [x] `upgrade.cli.ts` — wrap `upgradePackage` body in `withHelp`

### Phase 4 — Move audit-exclusive lib files

- [x] Create `src/commands/audit/lib/`
- [x] Move `src/lib/audit/audit.ts` → `src/commands/audit/lib/audit.ts`
  - Update imports in `audit.cli.ts`
- [x] Move `src/lib/prompts/audit.prompt.ts` → `src/commands/audit/lib/audit.prompt.ts`
  - Update imports in `audit.cli.ts`
- [x] Delete empty `src/lib/audit/` folder

### Phase 5 — Move upgrade-exclusive lib files

- [x] Create `src/commands/upgrade/lib/`
- [x] Move `agent-docs-migration.ts` → `src/commands/upgrade/lib/agent-docs-migration.ts`
- [x] Move `src/lib/package-policy/docs-restructure.utils.ts` → `src/commands/upgrade/lib/docs-restructure.utils.ts`
  - Update internal imports: `commands/upgrade/lib/upgrade.prompt` → `./upgrade.prompt.js`
  - Update internal imports: `commands/upgrade/lib/upgrade-metadata.utils` → `commands/upgrade/lib/upgrade-metadata.utils` (stays)
- [x] Move `src/lib/package-policy/merge.utils.ts` → `src/commands/upgrade/lib/merge.utils.ts`
- [x] Move `src/lib/package-policy/node.utils.ts` → `src/commands/upgrade/lib/node.utils.ts`
- [x] Move `src/lib/package-policy/plan.utils.ts` → `src/commands/upgrade/lib/plan.utils.ts`
  - Update internal imports: relative paths to lib files that moved
- [x] Move `src/lib/package-policy/rename.utils.ts` → `src/commands/upgrade/lib/rename.utils.ts`
- [x] Move `src/lib/package-policy/template-sync.utils.ts` → `src/commands/upgrade/lib/template-sync.utils.ts`
  - Update internal imports: `commands/upgrade/lib/upgrade-metadata.utils` → stays as-is (path alias still works)
- [x] Move `src/commands/upgrade/lib/upgrade.prompt.ts` → `src/commands/upgrade/lib/upgrade.prompt.ts`
- [x] Update all imports in `upgrade.cli.ts`
- [x] Verify `src/lib/package-policy/` only contains shared package-policy helpers

### Phase 6 — Verify & cleanup

- [x] `pnpm typecheck` passes
- [x] `pnpm test` passes
- [x] `pnpm build` passes
- [x] Verify no stale imports remain pointing to old paths
- [x] Check `src/lib/prompts/` after command-local prompt moves

---

## Import Map (for reference during implementation)

### src/cli.ts changes

```
./commands/audit.cli.js    → ./commands/audit/audit.cli.js
./commands/create.cli.js   → ./commands/create/create.cli.js
./commands/deps.cli.js     → ./commands/deps/deps.cli.js
./commands/features.cli.js → ./commands/features/features.cli.js
./commands/upgrade/upgrade.cli.js
```

### audit.cli.ts import changes

```
'help/audit.help'                  → './audit.help.js'
'../lib/audit/audit.js'            → './lib/audit.js'
'../lib/prompts/audit.prompt.js'   → './lib/audit.prompt.js'
```

### upgrade.cli.ts import changes (lib moves)

```
'lib/package-policy/agent-docs-migration'  → './lib/agent-docs-migration.js'
'lib/package-policy/docs-restructure.utils' → './lib/docs-restructure.utils.js'
'lib/package-policy/merge.utils'           → './lib/merge.utils.js'
'commands/upgrade/lib/upgrade-metadata.utils' → './lib/upgrade-metadata.utils.js' (STAYS in lib/package-policy/ — use path alias or relative path up)
'lib/package-policy/node.utils'            → './lib/node.utils.js'
'lib/package-policy/plan.utils'            → './lib/plan.utils.js'
'lib/package-policy/rename.utils'          → './lib/rename.utils.js'
'lib/package-policy/template-sync.utils'   → './lib/template-sync.utils.js'
'commands/upgrade/lib/upgrade.prompt'        → './lib/upgrade.prompt.js'
'upgrade.help' → './upgrade.help.js'
```

Note: `dependencies.utils`, `package-json.utils` keep their `lib/package-policy/*` path aliases (stay in src/lib/).

### docs-restructure.utils.ts import changes

```
'commands/upgrade/lib/upgrade.prompt'       → './upgrade.prompt.js'
'commands/upgrade/lib/upgrade-metadata.utils' → 'commands/upgrade/lib/upgrade-metadata.utils' (stays)
```

### plan.utils.ts import changes

```
'lib/package-policy/node.utils'     → './node.utils.js'
'lib/package-policy/rename.utils'   → './rename.utils.js'
'lib/package-policy/package-json.utils' → 'lib/package-policy/package-json.utils' (stays)
'lib/package-policy/dependencies.utils' → 'lib/package-policy/dependencies.utils' (stays)
'lib/package-policy/merge.utils'    → './merge.utils.js'
'commands/upgrade/lib/upgrade-metadata.utils' → 'commands/upgrade/lib/upgrade-metadata.utils' (stays)
```

### template-sync.utils.ts import changes

```
'commands/upgrade/lib/upgrade-metadata.utils' → 'commands/upgrade/lib/upgrade-metadata.utils' (stays)
```
