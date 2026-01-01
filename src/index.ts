#!/usr/bin/env node

import { createPackage } from './commands/create.js';

import process from 'node:process';

const cwd = process.cwd();

// For now, just run the create command
// Later we can add proper CLI routing with command selection
await createPackage({ cwd });
