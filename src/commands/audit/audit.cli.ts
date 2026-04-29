import { join } from 'node:path';
import { createFlowContext } from '@finografic/cli-kit/flow';
import { withHelp } from '@finografic/cli-kit/render-help';
import { errorMessage, getPathArg, infoMessage, intro, outro, resolveTargetDir } from 'utils';

import { auditFeatures, filterAuditEntriesForSelfPackage, sortAuditEntries } from './lib/audit.js';
import { promptAuditSuggest } from './lib/audit.prompt.js';
import { readPackageJson } from 'lib/migrate/package-json.utils';
import { pc } from 'utils/picocolors';
import { validateExistingPackage } from 'utils/validation.utils';

import { applyFeaturesToTarget } from '../features/features.cli.js';
import { help } from './audit.help.js';

export async function auditPackage(argv: string[], options: { targetDir: string }): Promise<void> {
  return withHelp(argv, help, async () => {
    intro('Audit @finografic package features');

    const flow = createFlowContext(argv, { y: { type: 'boolean' } });
    const pathArg = getPathArg(argv);
    const targetDir = resolveTargetDir(options.targetDir, pathArg);

    const validation = validateExistingPackage(targetDir);
    if (!validation.ok) {
      errorMessage(validation.reason || 'Not a valid package directory');
      process.exit(1);
    }

    const packageJson = await readPackageJson(join(targetDir, 'package.json'));
    const targetPackageName = typeof packageJson.name === 'string' ? packageJson.name : undefined;

    const entries = filterAuditEntriesForSelfPackage(await auditFeatures({ targetDir }), targetPackageName);

    const partialCount = entries.filter((e) => e.status === 'partial').length;
    const missingCount = entries.filter((e) => e.status === 'missing').length;

    if (partialCount + missingCount > 0) {
      const parts: string[] = [];
      if (partialCount > 0) {
        parts.push(pc.yellow(`${partialCount} partial`));
      }
      if (missingCount > 0) {
        parts.push(pc.red(`${missingCount} missing`));
      }
      infoMessage(parts.join(pc.dim(' · ')));
    }

    const actionable = sortAuditEntries(entries);

    if (actionable.length === 0) {
      outro('All features are up to date');
      return;
    }

    const selectedFeatureIds = await promptAuditSuggest(flow, actionable);

    if (!selectedFeatureIds || selectedFeatureIds.length === 0) {
      outro('No features selected');
      return;
    }

    await applyFeaturesToTarget(targetDir, selectedFeatureIds, { yesAll: flow.yesMode });
    outro('Audit complete');
  });
}
