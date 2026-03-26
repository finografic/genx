import type { FlowContext } from 'utils/flow.utils';
import { promptSelect } from 'utils/flow.utils';
import { PACKAGE_TYPES } from 'config/package-types.config';
import type { PackageType } from 'types/package-type.types';

/**
 * Prompt user to select a package type.
 * Supports --type <id> to skip the prompt and -y to use the default (library).
 * Returns the selected PackageType object, or null if cancelled.
 */
export async function promptPackageType(flow: FlowContext): Promise<PackageType | null> {
  // --type flag: find PackageType by id (flag value is a string id, not the object)
  const typeFlag = flow.flags['type' as keyof typeof flow.flags];
  if (typeFlag !== undefined) {
    const found = PACKAGE_TYPES.find((t) => t.id === String(typeFlag));
    if (found) return found;
    // Unknown type id — fall through to prompt
  }

  // -y flag: use first type (library) as default
  if (flow.yesMode) return PACKAGE_TYPES[0] ?? null;

  const selected = await promptSelect(flow, {
    message: 'What type of package are you creating?',
    options: PACKAGE_TYPES.map((type) => ({
      value: type,
      label: type.label,
      hint: type.description,
    })),
    required: true, // yes-mode already handled above
  });

  return selected as PackageType;
}
