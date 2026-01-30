import * as pc from 'picocolors';

import { defaultHelpOptions } from 'config/help.config';
import type { HelpConfig, HelpNote, HelpNoteOptions, HelpNoteReturn } from 'types/help.types';
import { padLines, padValue } from './padding.utils';

export function renderMainSignature(main: HelpConfig['main']): string {
  return pc.bold(pc.cyanBright(main.bin))
    + (main.args ? ` ${pc.bold(pc.whiteBright(main.args))}` : '');
}

interface CommandsNoteProps {
  commands: HelpNote;
  minWidth?: number;
  options?: HelpNoteOptions;
}

export function renderCommandsNote(
  { commands, minWidth, options }: CommandsNoteProps,
): HelpNoteReturn {
  const title = commands.title;
  const labelWidth = options?.labels.minWidth ?? defaultHelpOptions.labels.minWidth;

  const content = commands.list
    .map((command) => {
      const label = pc.cyanBright(command.label);
      const paddedLabel = padValue(label, labelWidth);
      return `${paddedLabel}  ${command.description}`;
    })
    .join('\n');

  const formattedContent = minWidth ? padLines(content, minWidth) : content;

  return [formattedContent, title, { format: (line: string) => line }];
}

interface ExamplesNoteProps {
  examples: HelpNote;
  minWidth?: number;
  options?: HelpNoteOptions;
}

export function renderExamplesNote(
  { examples, minWidth = defaultHelpOptions.minWidth }: ExamplesNoteProps,
): HelpNoteReturn {
  const title = examples.title;
  const content = examples.list
    .map((example) => {
      const parts: string[] = [];

      if (example.label) {
        parts.push(pc.dim(`# ${example.label}`));
      }

      parts.push(pc.white(example.description));

      return parts.join('\n');
    })
    .join('\n\n');

  const formattedContent = minWidth ? padLines(content, minWidth) : content;

  return [formattedContent, title, { format: (line: string) => line }];
}

interface FooterNoteProps {
  footer: HelpNote;
  minWidth?: number;
  options?: HelpNoteOptions;
}

export function renderFooterNote(
  { footer, minWidth = defaultHelpOptions.minWidth }: FooterNoteProps,
): HelpNoteReturn {
  const title = footer.title;
  const content = footer.list
    .map((item) =>
      item.description ? `${pc.white(item.label)}  ${item.description}` : `${pc.white(item.label)}`,
    )
    .join('\n');

  const formattedContent = minWidth ? padLines(content, minWidth) : content;

  return [formattedContent, title, { format: (line: string) => line }];
}
