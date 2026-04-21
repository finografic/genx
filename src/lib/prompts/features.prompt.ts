import { promptMultiSelect } from '@finografic/cli-kit/flow';
import type { FlowContext } from '@finografic/cli-kit/flow';
import { features } from 'features/feature-registry';
import type { FeatureId } from 'features/feature.types';

/**
 * Prompt user to select features. Returns array of selected feature IDs.
 *
 * @param excludeFeatureIds — omit from the list (e.g. `oxcConfig` is template-default on `create` and only
 *   needed for `migrate` / `features`).
 */
export async function promptFeatures(
  flow: FlowContext,
  initialValues?: FeatureId[],
  excludeFeatureIds?: readonly FeatureId[],
): Promise<FeatureId[]> {
  const excluded = new Set(excludeFeatureIds ?? []);
  const options = features
    .filter((feature) => !excluded.has(feature.id))
    .map((feature) => ({
      value: feature.id,
      label: feature.label,
      hint: feature.hint,
    }));

  return promptMultiSelect(flow, {
    message: 'Select optional features:',
    options,
    initialValues: initialValues?.filter((id) => !excluded.has(id)),
  });
}
