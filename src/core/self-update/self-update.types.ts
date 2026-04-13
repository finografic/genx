export interface UpdateCache {
  /** ISO date string — when we last hit the registry. */
  lastChecked: string;
  /** Latest @finografic/deps-policy version seen at lastChecked. */
  latestVersion: string;
}
