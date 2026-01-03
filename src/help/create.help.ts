import { renderHelp } from './renderHelp.js';

export function showCreateHelp(): void {
  renderHelp('finografic-create create', [
    {
      title: 'Usage',
      body: `
finografic-create create

Scaffolds a new @finografic package interactively.
`.trim(),
    },
    {
      title: 'What It Does',
      body: `
1. Prompts for package configuration (scope, name, description, author)
2. Prompts for optional features (AI rules, vitest, GitHub workflow)
3. Creates project structure from templates
4. Installs dependencies
5. Initializes git repository
`.trim(),
    },
    {
      title: 'Interactive Prompts',
      body: `
- Package scope (default: finografic)
- Package name
- Package description
- Author information (name, email, URL)
- Optional features (AI rules, vitest, GitHub workflow)
`.trim(),
    },
  ]);
}
