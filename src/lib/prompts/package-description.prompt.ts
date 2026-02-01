import * as clack from '@clack/prompts';

import { cancel } from 'utils/prompts.utils';
import { descriptionSchema } from 'utils/validation.utils';

export async function promptPackageDescription(defaults: {
  description: string;
}): Promise<string | null> {
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

  return description;
}
