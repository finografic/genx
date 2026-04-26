export interface ManagedTarget {
  name: string;
  path: string;
}

export interface ManagedConfig {
  /**
   * Absolute path to the local @finografic/deps-policy repo. Used by `genx deps --update-policy` and `genx
   * deps --managed`.
   */
  depsPolicyPath?: string;
  managed: ManagedTarget[];
}
