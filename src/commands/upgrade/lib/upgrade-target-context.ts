import { resolve } from 'node:path';
import { createDiffConfirmState } from '@finografic/cli-kit/file-diff';
import { errorMessage } from 'utils';
import type { FeatureId } from 'features/feature.types';

import { readPackageJson } from 'lib/package-policy/package-json.utils';
import { validateExistingPackage } from 'utils/validation.utils';

import { upgradeConfig } from 'config/upgrade.config';
import type { PackageJson } from 'types/package-json.types';
import type { TemplateVars } from 'types/template.types';
import type { UpgradeOnlySection } from 'types/upgrade.types';

import { planUpgrade } from './plan.utils.js';
import { getScopeAndName } from './upgrade-metadata.utils.js';
import { confirmUpgradeTarget } from './upgrade.prompt.js';

export interface UpgradeTargetContext {
  targetDir: string;
  packageJsonPath: string;
  packageJson: PackageJson;
  parsed: { scope: string; name: string };
  vars: TemplateVars;
  plan: string[];
  state: Awaited<ReturnType<typeof planUpgrade>>['state'];
  diffState: ReturnType<typeof createDiffConfirmState>;
}

export async function createUpgradeTargetContext(params: {
  targetDir: string;
  only: Set<UpgradeOnlySection> | null;
  debug: boolean;
  selectedFeatureIds: FeatureId[];
}): Promise<UpgradeTargetContext | null> {
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

  const ok = await confirmUpgradeTarget({
    scope: parsed.scope,
    name: parsed.name,
    expectedScope: upgradeConfig.defaultScope,
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

  const { plan, state } = await planUpgrade(
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
