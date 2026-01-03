export type MigrateOnlySection = 'package-json' | 'hooks' | 'nvmrc' | 'eslint' | 'workflows' | 'docs';

export type MigrateConfig = {
  /** Default scope expected for existing @finografic packages */
  defaultScope: string;

  /**
   * Files/dirs to sync from `templates/package/` into the target repository.
   * These are treated as "locked" convention surfaces.
   *
   * NOTE: copy is template-aware (token replacement) for common text formats.
   */
  syncFromTemplate: Array<{
    /** Path relative to `templates/package` */
    templatePath: string;
    /** Path relative to target repo root */
    targetPath: string;
    /** Which `--only` section controls this item */
    section: MigrateOnlySection;
  }>;

  /**
   * package.json patch behavior.
   * References sharedConfig to ensure consistency with create command.
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
};
