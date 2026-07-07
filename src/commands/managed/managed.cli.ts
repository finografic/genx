import { renderCommandHelp, withHelp } from '@finografic/cli-kit/render-help';

import { runManagedAuditFlow } from './managed.audit.js';
import { runManagedDepsFlow } from './managed.deps.js';
import { help } from './managed.help.js';
import { runManagedUpgradeFlow } from './managed.upgrade.js';

export async function runManaged(argv: string[], _context: { cwd: string }): Promise<void> {
  return withHelp(argv, help, async () => {
    const subcommand = argv[0];
    const subArgs = argv.slice(1);

    switch (subcommand) {
      case 'upgrade':
        return runManagedUpgradeFlow(subArgs);
      case 'deps':
        return runManagedDepsFlow(subArgs);
      case 'audit':
        return runManagedAuditFlow(subArgs);
      default:
        if (subcommand) {
          console.error(`Unknown managed subcommand: ${subcommand}\n`);
        }
        renderCommandHelp(help);
    }
  });
}
