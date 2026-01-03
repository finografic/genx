import pc from 'picocolors';

import type { HelpConfig } from 'utils/render-help/render-help.utils';
import { padLines } from './help-padding.utils';

export function renderExamplesBlock(
  examples: NonNullable<HelpConfig['examples']>,
  minWidth?: number
): string {
  const content = examples
    .map((ex) => {
      const parts: string[] = [];

      if (ex.comment) {
        parts.push(pc.dim(`# ${ex.comment}`));
      }

      parts.push(pc.cyan(ex.command));

      return parts.join('\n');
    })
    .join('\n\n');

  return minWidth ? padLines(content, minWidth) : content;
}
