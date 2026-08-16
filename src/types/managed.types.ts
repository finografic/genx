export interface ManagedTarget {
  name: string;
  path: string;
}

/** Optional overrides for the monorepo starter used by `genx create monorepo`. */
export interface MonorepoStarterConfig {
  /**
   * Tag to clone, overriding the one pinned in this genx release. Use to move ahead of a genx
   * release without waiting for one.
   */
  tag?: string;
}

export interface ManagedConfig {
  /**
   * Absolute path to the local @finografic/deps-policy repo. Used by `genx deps --update-policy` and `genx
   * deps --managed`.
   */
  depsPolicyPath?: string;
  /** Overrides for `genx create monorepo`. Omit entirely to use the pinned tag. */
  monorepoStarter?: MonorepoStarterConfig;
  managed: ManagedTarget[];
}
