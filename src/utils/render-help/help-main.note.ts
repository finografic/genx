import pc from 'picocolors';

import type { HelpConfig } from 'types/help.types';

export function renderMainSignature(main: HelpConfig['main']): string {
  console.clear();
  console.log('');

  return pc.bold(pc.cyanBright(main.bin)) + (main.args ? ` ${pc.bold(pc.whiteBright(main.args))}` : '');
}
