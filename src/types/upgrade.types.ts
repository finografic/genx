export const UPGRADE_ONLY_SECTIONS = [
  'package-json',
  'hooks',
  'nvmrc',
  'oxc-config',
  'workflows',
  'docs',
  'dependencies',
  'node',
  'renames',
  'merges',
  'gitignore',
] as const;

export type UpgradeOnlySection = (typeof UPGRADE_ONLY_SECTIONS)[number];

export interface UpgradeConfig {
  /** Default scope expected for existing @finografic packages */
  defaultScope: string;

  /**
   * Files/dirs to sync from `_templates/` into the target repository. These are treated as "locked"
   * convention surfaces.
   *
   * NOTE: copy is template-aware (token replacement) for common text formats.
   */
  syncFromTemplate: Array<{
    /** Path relative to `_templates` */
    templatePath: string;
    /** Path relative to target repo root */
    targetPath: string;
    /** Which upgrade operation controls this item */
    section: UpgradeOnlySection;
  }>;

  /**
   * Package.json patch behavior. References sharedConfig to ensure consistency with create command.
   */
  packageJson: {
    ensureScripts: Record<string, string>;
    ensureLintStaged: Record<string, string[]>;
    ensureKeywords: {
      /** Always ensure this keyword exists */
      includeFinograficKeyword: string;
      /** Also ensure the package name (without scope) exists */
      includePackageName: boolean;
    };
  };
}
