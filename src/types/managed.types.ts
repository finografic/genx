export interface ManagedTarget {
  name: string;
  path: string;
}

export interface ManagedConfig {
  managed: ManagedTarget[];
}
