#!/usr/bin/env node

import process from 'node:process';

import { renderHelp } from 'utils/render-help/render-help.utils.js';
import { createPackage } from './commands/create.cli.js';
import { migratePackage } from './commands/migrate.cli.js';
import { rootHelp } from './help/root.help.js';
import { safeExit } from './utils/env.utils.js';

type CommandHandler = (argv: string[], ctx: { cwd: string }) => Promise<void> | void;

async function main(): Promise<void> {
  const cwd = process.cwd();
  const argv = process.argv.slice(2);

  /* ────────────────────────────────────────────────────────── */
  /* Root help only                                              */
  /* ────────────────────────────────────────────────────────── */

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    renderHelp(rootHelp);
    return;
  }
  const command = argv[0];
  const args = argv.slice(1);

  /* ────────────────────────────────────────────────────────── */
  /* Command registry                                            */
  /* ────────────────────────────────────────────────────────── */

  const commands: Record<string, CommandHandler> = {
    create: async (argv, ctx) => {
      await createPackage(argv, ctx);
    },

    migrate: async (argv, ctx) => {
      await migratePackage(argv, ctx);
    },

    help: () => {
      renderHelp(rootHelp);
    },
  };

  /* ────────────────────────────────────────────────────────── */
  /* Guards                                                      */
  /* ────────────────────────────────────────────────────────── */

  if (!commands[command]) {
    console.error(`Unknown command: ${command}`);
    renderHelp(rootHelp);
    safeExit(1);
    return;
  }

  /* ────────────────────────────────────────────────────────── */
  /* Execute                                                     */
  /* ────────────────────────────────────────────────────────── */

  await commands[command](args, { cwd });
}

/* ────────────────────────────────────────────────────────── */
/* Bootstrap                                                    */
/* ────────────────────────────────────────────────────────── */

main().catch((error) => {
  console.error(error);
  safeExit(1);
});
