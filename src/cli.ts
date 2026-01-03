#!/usr/bin/env node

import process from 'node:process';

import { createPackage } from './commands/create.cli.js';
import { migratePackage } from './commands/migrate.cli.js';
import { showCreateHelp } from './help/create.help.js';
import { showMigrateHelp } from './help/migrate.help.js';
import { showRootHelp } from './help/root.help.js';

const cwd = process.cwd();
const argv = process.argv.slice(2);

const command = argv[0] ?? 'create';
const flags = argv.slice(1);

// Handle help flags
if (flags.includes('--help') || flags.includes('-h')) {
  if (command === 'migrate') {
    showMigrateHelp();
  } else if (command === 'create') {
    showCreateHelp();
  } else {
    showRootHelp();
  }
  process.exit(0);
}

// Route commands
switch (command) {
  case 'create':
    await createPackage({ cwd });
    break;

  case 'migrate':
    await migratePackage(argv, { cwd });
    break;

  case 'help':
    showRootHelp();
    break;

  default:
    console.error(`Unknown command: ${command}`);
    showRootHelp();
    process.exit(1);
}
