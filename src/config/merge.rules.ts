export type MergeStrategy = 'overwrite' | 'shallow-merge' | 'deep-merge' | 'custom';

export interface MergeRule {
  file: string;
  strategy: MergeStrategy;
}

export const mergeConfig: MergeRule[] = [
  {
    file: 'package.json',
    strategy: 'custom',
  },
  {
    file: 'oxlint.config.ts',
    strategy: 'overwrite',
  },
];
