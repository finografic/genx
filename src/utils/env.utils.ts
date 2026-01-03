import process from 'node:process';

/**
 * Check if we're running in development mode.
 * Development mode is when:
 * - NODE_ENV is 'development'
 * - Running via tsx (execPath contains 'tsx')
 * - Running from source TypeScript files
 */
export function isDevelopment(): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Check if running via tsx
  const execPath = process.execPath.toLowerCase();
  if (execPath.includes('tsx')) {
    return true;
  }

  // Check if running from source (not built dist)
  const mainModule = process.argv[1];
  if (mainModule && (mainModule.includes('/src/') || mainModule.endsWith('.ts'))) {
    return true;
  }

  return false;
}

/**
 * Exit the process with a code, but only in production mode.
 * In development mode, just return to allow natural exit.
 */
export function safeExit(code: number): void {
  if (isDevelopment()) {
    return;
  }
  process.exit(code);
}
