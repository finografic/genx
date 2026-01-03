import { intro, note, outro } from '@clack/prompts';

import { renderCommandsBlock } from './help-commands.utils';
import { renderExamplesBlock } from './help-examples.utils';
import { renderFooterBlock } from './help-footer.utils';
import { renderMainSignature } from './help-main.utils';

export interface HelpConfig {
  main: {
    bin: string;
    args?: string;
  };
  commands?: Array<{
    label: string;
    description: string;
  }>;
  examples?: Array<{
    comment?: string;
    command: string;
  }>;
  help?: Array<{
    label: string;
    description?: string;
  }>;
  minWidth?: number;
}

export function renderHelp(config: HelpConfig): void {
  // console.clear();
  console.log('');

  // Main command signature
  intro(renderMainSignature(config.main));

  // Commands box
  note(
    renderCommandsBlock(config),
    'Commands'
  );

  // Examples box
  if (config.examples?.length) {
    note(renderExamplesBlock(config.examples, config.minWidth), 'Examples');
  }

  // Help footer
  if (config.help?.length) {
    note(renderFooterBlock(config.help, config.minWidth), 'Get Help');
  }

  // Outro
  outro('Use --help with a command for more details');
}
