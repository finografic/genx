import { renderHelp } from 'utils/render-help/render-help.utils';

export function showCreateHelp(): void {
  renderHelp({
    main: {
      bin: 'finografic-create create',
    },
    examples: [
      {
        comment: 'Create a new package interactively',
        command: 'finografic-create create',
      },
    ],
    help: [
      {
        label: 'finografic-create create --help',
        description: 'Show this help message',
      },
    ],
    minWidth: 100
  });
}
