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
  /**
   * Absolute path to a local `monorepo-starter` checkout. When set, generation copies the working
   * tree instead of cloning a tag — including uncommitted work, which is the point: it lets you
   * see what a real workspace looks like before tagging anything.
   */
  path?: string;
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
