import pc from 'picocolors';

import type { HelpConfig } from 'utils/render-help/render-help.utils';
import { padLines } from './help-padding.utils';

export function renderFooterBlock(
  help: NonNullable<HelpConfig['help']>,
  minWidth?: number
): string {
  const content = help
    .map((item) =>
      item.description
        ? `  ${pc.cyan(item.label)}  ${item.description}`
        : `  ${pc.cyan(item.label)}`
    )
    .join('\n');

  return minWidth ? padLines(content, minWidth) : content;
}
