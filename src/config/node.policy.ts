export type NodeMajor = 20 | 22 | 24;

export interface NodePolicy {
  major: NodeMajor;
  /** Exact Node version pinned for local development. Written to .nvmrc. Format: "MAJOR.MINOR.PATCH" (e.g., "24.12.0") */
  local: {
    nvmrc: string;
  };
  /** Node version used in CI (GitHub Actions). Format: "MAJOR.x" or "MAJOR" (e.g., "24.x" or "24") */
  ci: {
    githubActions: string;
  };
  /** TypeScript typings for Node. Format: semver range (e.g., "^24.0.0") */
  types: {
    node: string;
  };
}

export const nodePolicy: NodePolicy = {
  major: 24,
  local: {
    nvmrc: '24.12.0',
  },
  ci: {
    githubActions: '24.x',
  },
  types: {
    node: '^24.0.0',
  },
};
