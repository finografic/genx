import { renderHelp } from 'utils/render-help/render-help.utils';

export function showMigrateHelp(): void {
  renderHelp({
    main: {
      bin: 'finografic-create migrate',
      args: '[path] [options]',
    },
    examples: [
      {
        comment: 'Dry run in current directory',
        command: 'finografic-create migrate',
      },
      {
        comment: 'Dry run against a specific directory',
        command: 'finografic-create migrate ../my-package',
      },
      {
        comment: 'Apply changes to a directory',
        command: 'finografic-create migrate ../my-package --write',
      },
      {
        comment: 'Only update specific sections',
        command: 'finografic-create migrate --only=package-json,eslint --write',
      },
    ],
    help: [
      {
        label: 'finografic-create migrate --help',
        description: 'Show this help message',
      },
    ],
  });
}
