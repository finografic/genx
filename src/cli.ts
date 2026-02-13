#!/usr/bin/env node

import { createRequire } from 'node:module';
import process from 'node:process';

import { renderHelp } from 'utils/render-help/render-help.utils.js';
import { createPackage } from './commands/create.cli.js';
import { addFeatures } from './commands/features.cli.js';
import { migratePackage } from './commands/migrate.cli.js';
import { rootHelp } from './help/root.help.js';
import { safeExit } from './utils/env.utils.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

type CommandHandler = (argv: string[], context: { cwd: string }) => Promise<void> | void;

const TEST_MESSAGE_A = 'Hello from';
const TEST_MESSAGE_B = 'git-cli';

console.log(`${TEST_MESSAGE_A} ${TEST_MESSAGE_B}!`);

async function main(): Promise<void> {
  const cwd = process.cwd();
  const argv = process.argv.slice(2);

  /* ────────────────────────────────────────────────────────── */
  /* Root help / version                                         */
  /* ────────────────────────────────────────────────────────── */

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    renderHelp(rootHelp);
    return;
  }

  if (argv[0] === '--version' || argv[0] === '-v') {
    console.log(version);
    return;
  }
  const command = argv[0];
  const args = argv.slice(1);

  /* ────────────────────────────────────────────────────────── */
  /* Command registry                                            */
  /* ────────────────────────────────────────────────────────── */

  const commands: Record<string, CommandHandler> = {
    create: async (argv, context) => {
      await createPackage(argv, context);
    },

    migrate: async (argv, context) => {
      await migratePackage(argv, context);
    },

    features: async (argv, context) => {
      await addFeatures(argv, { targetDir: context.cwd });
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
