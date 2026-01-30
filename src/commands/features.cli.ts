import type { FeatureId } from 'features/feature.types';
import { getFeature } from 'features/feature-registry';
import { featuresHelp } from 'help/features.help';
import * as pc from 'picocolors';
import { promptFeatures } from 'prompts/features.prompt';

import { errorMessage, infoMessage, intro, outro, outroDim } from 'utils';
import { isDevelopment, safeExit } from 'utils/env.utils';
import { renderHelp } from 'utils/render-help/render-help.utils';
import { validateExistingPackage } from 'utils/validation.utils';

/**
 * Add optional features to an existing @finografic package.
 */
export async function addFeatures(
  argv: string[],
  options: { targetDir: string },
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

  const { targetDir } = options;

  // 1. Validate we're in an existing package
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
  const appliedFeatures: FeatureId[] = [];
  const noopMessages: string[] = [];

  for (const featureId of selectedFeatureIds) {
    const feature = getFeature(featureId);
    if (!feature) {
      errorMessage(`Unknown feature: ${featureId}`);
      continue;
    }

    if (feature.detect) {
      const detected = await feature.detect({ targetDir });
      if (detected) {
        noopMessages.push(
          `${feature.label} already installed. No changes made.`,
        );
        continue;
      }
    }

    const result = await feature.apply({ targetDir });
    if (result.error) {
      safeExit(1);
      return;
    }

    if (result.applied.length > 0) {
      appliedFeatures.push(featureId);
    } else {
      noopMessages.push(
        result.noopMessage ?? `${feature.label} already installed. No changes made.`,
      );
    }
  }

  // 4. Done
  if (appliedFeatures.length > 0) {
    outro('Features added successfully!');
    console.log(pc.dim('Applied features:'), pc.cyan(appliedFeatures.join(', ')));
    for (const msg of noopMessages) {
      console.log(pc.dim(msg));
    }
  } else {
    outroDim('No changes made');
    for (const msg of noopMessages) {
      console.log(pc.dim(msg));
    }
  }
}
