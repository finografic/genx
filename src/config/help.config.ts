import type { HelpNoteOptions } from '@finografic/cli-kit/render-help';

export const defaultHelpOptions: HelpNoteOptions = {
  labels: {
    minWidth: 8,
  },
  minWidth: 64,
} as const;
