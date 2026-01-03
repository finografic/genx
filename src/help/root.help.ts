import { renderHelp } from 'utils/render-help/render-help.utils';

export function showRootHelp(): void {
  renderHelp(
    {
      main: { bin: 'finografic-create', args: '<command> [options]' },
      commands: [
        { label: 'create', description: 'Scaffold a new @finografic package' },
        { label: 'migrate', description: 'Sync conventions to an existing package' },
        { label: 'help', description: 'Show this help message' },
      ],
      examples: [
        { comment: 'Create a new package', command: 'finografic-create create' },
        { comment: 'Migrate current directory (dry-run)', command: 'finografic-create migrate' },
        { comment: 'Migrate a specific directory (apply changes)', command: 'finografic-create migrate ../my-package --write' },
        { comment: 'Migrate only specific sections', command: 'finografic-create migrate --only=package-json,eslint --write' },
      ],
      help: [
        { label: 'finografic-create help', description: '' },
        { label: 'finografic-create <command> --help', description: '' },
      ],
      minWidth: 64
    });
}
