import { promptText } from 'core/flow';
import type { FlowContext } from 'core/flow';

import { packageNameSchema, scopeSchema } from 'utils/validation.utils';
import { descriptionSchema } from 'utils/validation.utils';

export interface PackageManifest {
  scope: string;
  name: string;
  description: string;
}

export async function promptPackageManifest(
  flow: FlowContext,
  defaults: {
    scope: string;
    description: string;
  },
): Promise<PackageManifest> {
  const scope = await promptText(flow, {
    message: 'Package scope (finografic or @finografic):',
    placeholder: defaults.scope,
    default: defaults.scope,
    validate: (value) => {
      const result = scopeSchema.safeParse(value);
      return result.success ? undefined : result.error.issues[0]?.message;
    },
  });

  const name = await promptText(flow, {
    flagKey: 'name',
    message: 'Package name:',
    placeholder: 'my-package',
    validate: (value) => {
      if (value && value.includes('/')) {
        return 'Enter the package name only (no scope). Example: my-package';
      }
      const result = packageNameSchema.safeParse(value);
      return result.success ? undefined : result.error.issues[0]?.message;
    },
  });

  const description = await promptText(flow, {
    message: 'Package description:',
    placeholder: defaults.description,
    default: defaults.description,
    validate: (value) => {
      const result = descriptionSchema.safeParse(value);
      return result.success ? undefined : result.error.issues[0]?.message;
    },
  });

  return { scope, name, description };
}
