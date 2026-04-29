import { resolve } from 'node:path';
import { createDiffConfirmState } from '@finografic/cli-kit/file-diff';
import { errorMessage } from 'utils';
import type { FeatureId } from 'features/feature.types';

import { readPackageJson } from 'lib/migrate/package-json.utils';
import { validateExistingPackage } from 'utils/validation.utils';

import { migrateConfig } from 'config/migrate.config';
import type { MigrateOnlySection } from 'types/migrate.types';
import type { PackageJson } from 'types/package-json.types';
import type { TemplateVars } from 'types/template.types';

import { getScopeAndName } from './migrate-metadata.utils.js';
import { confirmMigrateTarget } from './migrate.prompt.js';
import { planMigration } from './plan.utils.js';

export interface MigrateTargetContext {
  targetDir: string;
  packageJsonPath: string;
  packageJson: PackageJson;
  parsed: { scope: string; name: string };
  vars: TemplateVars;
  plan: string[];
  state: Awaited<ReturnType<typeof planMigration>>['state'];
  diffState: ReturnType<typeof createDiffConfirmState>;
}

export async function createMigrateTargetContext(params: {
  targetDir: string;
  only: Set<MigrateOnlySection> | null;
  debug: boolean;
  selectedFeatureIds: FeatureId[];
}): Promise<MigrateTargetContext | null> {
  const validation = validateExistingPackage(params.targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Not a valid package directory');
    process.exit(1);
    return null;
  }

  const packageJsonPath = resolve(params.targetDir, 'package.json');
  const packageJson = await readPackageJson(packageJsonPath);
  const parsed = getScopeAndName(packageJson.name);
  if (!parsed) {
    errorMessage('Unable to read package name from package.json');
    process.exit(1);
    return null;
  }

  const ok = await confirmMigrateTarget({
    scope: parsed.scope,
    name: parsed.name,
    expectedScope: migrateConfig.defaultScope,
  });
  if (!ok) {
    process.exit(0);
    return null;
  }

  const vars: TemplateVars = {
    SCOPE: parsed.scope,
    NAME: parsed.name,
    PACKAGE_NAME: `${parsed.scope}/${parsed.name}`,
    YEAR: new Date().getFullYear().toString(),
    DESCRIPTION: typeof packageJson.description === 'string' ? packageJson.description : '',
    AUTHOR_NAME: '',
    AUTHOR_EMAIL: '',
  };

  const { plan, state } = await planMigration(
    params.targetDir,
    packageJson,
    parsed,
    params.selectedFeatureIds,
    params.only,
    params.debug,
  );

  return {
    targetDir: params.targetDir,
    packageJsonPath,
    packageJson,
    parsed,
    vars,
    plan,
    state,
    diffState: createDiffConfirmState(),
  };
}
