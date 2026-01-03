import { renderHelp } from './renderHelp.js';

export function showMigrateHelp(): void {
  renderHelp('finografic-create migrate', [
    {
      title: 'Usage',
      body: `
finografic-create migrate [path] [options]

If no path is provided, the current working directory is used.
`.trim(),
    },
    {
      title: 'Options',
      body: `
--write
  Apply changes (default is dry-run)

--only=<sections>
  Limit migration to specific sections.
  Comma-separated list: package-json,hooks,nvmrc,eslint,workflows,docs
`.trim(),
    },
    {
      title: 'What Gets Migrated',
      body: `
package-json  Update scripts, lint-staged, keywords
hooks        Sync .simple-git-hooks.mjs
nvmrc        Sync .nvmrc (Node version)
eslint       Sync eslint.config.mjs
workflows    Sync .github/workflows/release.yml
docs         Sync docs/ directory (DEVELOPER_WORKFLOW.md, etc.)
`.trim(),
    },
    {
      title: 'Notes',
      body: `
- migrate is dry-run by default
- no files are modified unless --write is passed
- package.json name/scope is extracted automatically
- keywords are updated to include 'finografic' and package name
`.trim(),
    },
  ]);
}
