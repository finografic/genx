import * as clack from '@clack/prompts';

import { pc } from './picocolors';

export function intro(message: string): void {
  clack.intro(pc.bgCyan(pc.black(` ${message} `)));
}

export function outro(message: string): void {
  clack.outro(pc.green(message));
}

export function outroDim(message: string): void {
  clack.outro(pc.dim(message));
}

export function errorMessage(message: string): void {
  clack.log.error(pc.red(message));
}

export function successMessage(message: string): void {
  clack.log.success(pc.green(message));
}

export function successUpdatedMessage(message: string): void {
  clack.log.success(pc.cyan(message));
}

export function successRemovedMessage(message: string): void {
  clack.log.success(pc.yellow(message));
}

export function infoMessage(message: string): void {
  clack.log.info(pc.cyan(message));
}

/** Clack log line without forcing cyan on the message body (preserves embedded picocolors). */
export function logMessage(message: string): void {
  clack.log.message(message);
}

export function warnMessage(message: string): void {
  clack.log.warn(pc.yellow(message));
}

/**
 * Canonical cancellation handler. Always call this instead of duplicating clack.cancel().
 */
export function cancel(): null {
  clack.cancel('Operation cancelled');
  return null;
}

/**
 * Show a spinner for async operations.
 */
export function spinner(): ReturnType<typeof clack.spinner> {
  return clack.spinner();
}
