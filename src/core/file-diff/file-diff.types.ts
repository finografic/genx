/** Action returned by a diff-confirmation prompt. */
export type DiffAction = 'write' | 'skip' | 'write-all';

/**
 * Mutable state object for tracking yes-to-all across multiple file confirmations.
 * Pass the same instance to every `confirmFileWrite` call in a session.
 */
export interface DiffConfirmState {
  yesAll: boolean;
}
