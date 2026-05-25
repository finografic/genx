import { renderCommandHelp, withHelp } from '@finografic/cli-kit/render-help';

import { runManagedDepsFlow } from './managed.deps.js';
import { runManagedFeaturesFlow } from './managed.features.js';
import { help } from './managed.help.js';
import { runManagedMigrateFlow } from './managed.migrate.js';

export async function runManaged(argv: string[], _context: { cwd: string }): Promise<void> {
  return withHelp(argv, help, async () => {
    const subcommand = argv[0];
    const subArgs = argv.slice(1);

    switch (subcommand) {
      case 'migrate':
        return runManagedMigrateFlow(subArgs);
      case 'deps':
        return runManagedDepsFlow(subArgs);
      case 'features':
        return runManagedFeaturesFlow(subArgs);
      default:
        if (subcommand) {
          console.error(`Unknown managed subcommand: ${subcommand}\n`);
        }
        renderCommandHelp(help);
    }
  });
}
