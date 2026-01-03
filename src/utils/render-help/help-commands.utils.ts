import pc from 'picocolors';

import type { HelpConfig } from 'utils/render-help/render-help.utils';
import { padLines } from './help-padding.utils';

export function renderCommandsBlock(config: HelpConfig): string {
  if (!config.commands?.length) return '';

  const content = config.commands.map(
    (cmd) =>
      `${pc.bold(pc.cyanBright(cmd.label))}  ${cmd.description}`
  ).join('\n');

  return config.minWidth ? padLines(content, config.minWidth) : content;
}
