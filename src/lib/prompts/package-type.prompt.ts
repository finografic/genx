import * as clack from '@clack/prompts';

import { cancel } from 'utils/prompts.utils';
import { PACKAGE_TYPES } from 'config/package-types.config';
import type { PackageType } from 'types/package-type.types';

/**
 * Prompt user to select a package type.
 * Returns the selected PackageType object, or null if cancelled.
 */
export async function promptPackageType(): Promise<PackageType | null> {
  const selected = await clack.select({
    message: 'What type of package are you creating?',
    options: PACKAGE_TYPES.map((type) => ({
      value: type,
      label: type.label,
      hint: type.description,
    })),
  });

  if (clack.isCancel(selected)) return cancel();

  return selected as PackageType;
}
