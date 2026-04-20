import { promptSelect } from '@finografic/cli-kit/flow';
import type { FlowContext } from '@finografic/cli-kit/flow';

import { PACKAGE_TYPES } from 'config/package-types.config';
import type { PackageType } from 'types/package-type.types';

/**
 * Prompt user to select a package type.
 * Returns the selected PackageType object.
 */
export async function promptPackageType(flow: FlowContext): Promise<PackageType> {
  return promptSelect(flow, {
    flagKey: 'type',
    fromFlag: (id) => PACKAGE_TYPES.find((t) => t.id === id),
    message: 'What type of package are you creating?',
    options: PACKAGE_TYPES.map((type) => ({
      value: type,
      label: type.label,
      hint: type.description,
    })),
    default: PACKAGE_TYPES[0],
  });
}
