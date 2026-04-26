import { createFlowContext } from '@finografic/cli-kit/flow';
import { renderHelp } from '@finografic/cli-kit/render-help';
import { auditHelp } from 'help/audit.help';
import { errorMessage, getPathArg, infoMessage, intro, outro, resolveTargetDir } from 'utils';

import { pc } from 'utils/picocolors';
import { validateExistingPackage } from 'utils/validation.utils';

import { auditFeatures, sortAuditEntries } from '../lib/audit/audit.js';
import { promptAuditSuggest } from '../lib/prompts/audit.prompt.js';
import { applyFeaturesToTarget } from './features.cli.js';

/**
 * Audit an existing package: detect which features are installed, partial, or missing, then offer a
 * pre-selected prompt to apply the outstanding ones.
 */
export async function auditPackage(argv: string[], options: { targetDir: string }): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    renderHelp(auditHelp);
    return;
  }

  intro('Audit @finografic package features');

  const flow = createFlowContext(argv, { y: { type: 'boolean' } });
  const pathArg = getPathArg(argv);
  const targetDir = resolveTargetDir(options.targetDir, pathArg);

  const validation = validateExistingPackage(targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Not a valid package directory');
    process.exit(1);
  }

  const entries = await auditFeatures({ targetDir });

  const installedCount = entries.filter((e) => e.status === 'installed').length;
  const partialCount = entries.filter((e) => e.status === 'partial').length;
  const missingCount = entries.filter((e) => e.status === 'missing').length;

  const parts: string[] = [
    pc.green(`${installedCount} installed`),
    pc.yellow(`${partialCount} partial`),
    pc.red(`${missingCount} missing`),
  ];
  infoMessage(parts.join(pc.dim(' · ')));

  const actionable = sortAuditEntries(entries);

  if (actionable.length === 0) {
    outro('All features are up to date');
    return;
  }

  const selectedFeatureIds = flow.yesMode
    ? actionable.map((e) => e.feature.id)
    : await promptAuditSuggest(flow, actionable);

  if (!selectedFeatureIds || selectedFeatureIds.length === 0) {
    outro('No features selected');
    return;
  }

  await applyFeaturesToTarget(targetDir, selectedFeatureIds, { yesAll: flow.yesMode });
  outro('Audit complete');
}
