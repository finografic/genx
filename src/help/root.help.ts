import { renderHelp } from './renderHelp.js';

export function showRootHelp(): void {
  renderHelp('finografic-create', [
    {
      title: 'Usage',
      body: `
finografic-create <command> [options]

Commands:
  create    Scaffold a new @finografic package
  migrate   Sync conventions to an existing package
  help      Show this help message
`.trim(),
    },
    {
      title: 'Examples',
      body: `
# Create a new package
finografic-create create

# Migrate current directory (dry-run)
finografic-create migrate

# Migrate a specific directory (apply changes)
finografic-create migrate ../my-package --write

# Migrate only specific sections
finografic-create migrate --only=package-json,eslint --write
`.trim(),
    },
    {
      title: 'Get Help',
      body: `
finografic-create help
finografic-create <command> --help
`.trim(),
    },
  ]);
}
