#!/usr/bin/env node

import { createRequire } from 'node:module';
import process from 'node:process';
import { renderHelp } from '@finografic/cli-kit/render-help';

import { cliHelp } from './cli.help.js';
import { auditPackage } from './commands/audit.cli.js';
import { createPackage } from './commands/create.cli.js';
import { syncDeps } from './commands/deps.cli.js';
import { addFeatures } from './commands/features.cli.js';
import { migratePackage } from './commands/migrate.cli.js';
import { runSelfUpdateCheck, runSelfUpdateForced } from './core/self-update/index.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

type CommandHandler = (argv: string[], context: { cwd: string }) => Promise<void> | void;

async function main(): Promise<void> {
  const cwd = process.cwd();
  const argv = process.argv.slice(2);

  /* ────────────────────────────────────────────────────────── */
  /* Root help / version                                        */
  /* ────────────────────────────────────────────────────────── */

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    renderHelp(cliHelp);
    return;
  }

  if (argv[0] === '--version' || argv[0] === '-v') {
    console.log(version);
    return;
  }

  const command = argv[0];
  const args = argv.slice(1);

  /* ────────────────────────────────────────────────────────── */
  /* Self-update check (skipped for update-self itself)        */
  /* ────────────────────────────────────────────────────────── */

  if (command !== 'update-self') {
    await runSelfUpdateCheck();
  }

  /* ────────────────────────────────────────────────────────── */
  /* Command registry                                           */
  /* ────────────────────────────────────────────────────────── */

  const commands: Record<string, CommandHandler> = {
    'create': async (argv, context) => {
      await createPackage(argv, context);
    },

    'migrate': async (argv, context) => {
      await migratePackage(argv, context);
    },

    'deps': async (argv, context) => {
      await syncDeps(argv, context);
    },

    'features': async (argv, context) => {
      await addFeatures(argv, { targetDir: context.cwd });
    },

    'audit': async (argv, context) => {
      await auditPackage(argv, { targetDir: context.cwd });
    },

    'update-self': async () => {
      await runSelfUpdateForced();
    },

    'help': () => {
      renderHelp(cliHelp);
    },
  };

  /* ────────────────────────────────────────────────────────── */
  /* Guards                                                      */
  /* ────────────────────────────────────────────────────────── */

  if (!commands[command]) {
    console.error(`Unknown command: ${command}`);
    renderHelp(cliHelp);
    process.exit(1);
    return;
  }

  /* ────────────────────────────────────────────────────────── */
  /* Execute                                                    */
  /* ────────────────────────────────────────────────────────── */

  await commands[command](args, { cwd });
}

/* ────────────────────────────────────────────────────────── */
/* Bootstrap                                                  */
/* ────────────────────────────────────────────────────────── */

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
