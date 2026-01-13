import { getFeature } from 'features/feature-registry';
import { featuresHelp } from 'help/features.help';
import pc from 'picocolors';
import { promptFeatures } from 'prompts/features.prompt';

import { errorMessage, infoMessage, intro, outro } from 'utils';
import { isDevelopment, safeExit } from 'utils/env.utils';
import { renderHelp } from 'utils/render-help/render-help.utils';
import { validateExistingPackage } from 'utils/validation.utils';

// NOTE: This command never prompts directly.
// All user input is collected via promptFeatures().

/**
 * Add optional features to an existing @finografic package.
 */
export async function addFeatures(
  argv: string[],
  context: { cwd: string; },
): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    renderHelp(featuresHelp);
    return;
  }

  intro('Add features to existing @finografic package');

  const debug = isDevelopment() || process.env.FINOGRAFIC_DEBUG === '1';
  if (debug) {
    infoMessage(`execPath: ${process.execPath}`);
    infoMessage(`argv[1]: ${process.argv[1] ?? ''}`);
  }

  // 1. Validate we're in an existing package
  const targetDir = context.cwd;
  const validation = validateExistingPackage(targetDir);
  if (!validation.ok) {
    errorMessage(validation.reason || 'Not a valid package directory');
    safeExit(1);
    return;
  }

  // 2. Prompt for features
  const selectedFeatureIds = await promptFeatures();
  if (!selectedFeatureIds) {
    safeExit(0);
    return;
  }

  // 3. Apply selected features
  const applied: string[] = [];
  const ctx = { targetDir };

  for (const featureId of selectedFeatureIds) {
    const feature = getFeature(featureId);
    if (!feature) {
      errorMessage(`Unknown feature: ${featureId}`);
      continue;
    }

    const result = await feature.apply(ctx);
    if (result.error) {
      safeExit(1);
      return;
    }
    applied.push(...result.applied);
  }

  // 4. Done!
  if (applied.length > 0) {
    outro('Features added successfully!');
    console.log(pc.dim('Applied features:'), pc.cyan(applied.join(', ')));
  } else {
    outro('No new features to add');
  }
}
