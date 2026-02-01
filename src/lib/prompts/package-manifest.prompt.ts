import * as clack from '@clack/prompts';

import { cancel } from 'utils/prompts.utils';
import { packageNameSchema, scopeSchema } from 'utils/validation.utils';
import { descriptionSchema } from 'utils/validation.utils';

export interface PackageManifest {
  scope: string;
  name: string;
  description: string;
}

export async function promptPackageManifest(defaults: {
  scope: string;
  description: string;
}): Promise<PackageManifest | null> {
  const scope = await clack.text({
    message: 'Package scope (finografic or @finografic):',
    placeholder: defaults.scope,
    initialValue: defaults.scope,
    validate: (value) => {
      const result = scopeSchema.safeParse(value);
      return result.success ? undefined : result.error.issues[0].message;
    },
  });

  if (clack.isCancel(scope)) return cancel();

  const name = await clack.text({
    message: 'Package name:',
    placeholder: 'my-package',
    validate: (value) => {
      if (value && value.includes('/')) {
        return 'Enter the package name only (no scope). Example: my-package';
      }
      const result = packageNameSchema.safeParse(value);
      return result.success ? undefined : result.error.issues[0].message;
    },
  });

  if (clack.isCancel(name)) return cancel();

  const description = await clack.text({
    message: 'Package description:',
    placeholder: defaults.description,
    initialValue: defaults.description,
    validate: (value) => {
      const result = descriptionSchema.safeParse(value);
      return result.success ? undefined : result.error.issues[0].message;
    },
  });

  if (clack.isCancel(description)) return cancel();

  return {
    scope,
    name,
    description,
  };
}
