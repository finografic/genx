import * as clack from '@clack/prompts';

import { emailSchema } from 'utils/validation.utils';

export type Author = {
  name: string;
  email: string;
  url: string;
};

type AuthorField = 'name' | 'email' | 'url';

export async function promptAuthor(
  defaults: Author,
): Promise<Author | null> {
  const fields = await clack.autocompleteMultiselect<AuthorField>({
    message: 'Select author fields to edit',
    options: [
      { value: 'name', label: 'Name', hint: defaults.name },
      { value: 'email', label: 'Email', hint: defaults.email },
      { value: 'url', label: 'URL', hint: defaults.url },
    ],
    placeholder: 'Type to filter fields...',
    initialValues: ['name', 'email', 'url'],
  });

  if (clack.isCancel(fields)) {
    clack.cancel('Operation cancelled');
    return null;
  }

  // Defensive but explicit: clack returns AuthorField[]
  const selected = new Set(fields);

  let name = defaults.name;
  let email = defaults.email;
  let url = defaults.url;

  if (selected.has('name')) {
    const value = await clack.text({
      message: 'Author name:',
      initialValue: name,
    });

    if (clack.isCancel(value)) return cancel();
    name = value;
  }

  if (selected.has('email')) {
    const value = await clack.text({
      message: 'Author email:',
      initialValue: email,
      validate: (v) =>
        emailSchema.safeParse(v).success
          ? undefined
          : 'Invalid email address',
    });

    if (clack.isCancel(value)) return cancel();
    email = value;
  }

  if (selected.has('url')) {
    const value = await clack.text({
      message: 'Author URL:',
      initialValue: url,
    });

    if (clack.isCancel(value)) return cancel();
    url = value;
  }

  return { name, email, url };
}

function cancel(): null {
  clack.cancel('Operation cancelled');
  return null;
}
