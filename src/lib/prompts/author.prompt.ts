import type { FlowContext } from 'utils/flow.utils';
import { promptAutocompleteMultiSelect, promptText } from 'utils/flow.utils';
import { emailSchema } from 'utils/validation.utils';

export type Author = {
  name: string;
  email: string;
  url: string;
};

type AuthorField = 'name' | 'email' | 'url';

export async function promptAuthor(
  flow: FlowContext,
  defaults: Author,
  scope: string,
): Promise<Author> {
  const scopeClean = scope.replace('@', '');
  const urlSuggestion = defaults.url || `https://github.com/${scopeClean}`;

  const fields = await promptAutocompleteMultiSelect<AuthorField>(flow, {
    message: 'Select author fields to edit',
    options: [
      { value: 'name', label: 'Name', hint: defaults.name },
      { value: 'email', label: 'Email', hint: defaults.email },
      { value: 'url', label: 'URL', hint: urlSuggestion },
    ],
    placeholder: 'Type to filter fields...',
    initialValues: ['name', 'email', 'url'],
  });

  // Defensive but explicit: clack returns AuthorField[]
  const selected = new Set(fields);

  let name = defaults.name;
  let email = defaults.email;
  let url = defaults.url;

  if (selected.has('name')) {
    name = await promptText(flow, {
      message: 'Author name:',
      default: name,
    });
  }

  if (selected.has('email')) {
    email = await promptText(flow, {
      message: 'Author email:',
      default: email,
      validate: (v) =>
        emailSchema.safeParse(v).success
          ? undefined
          : 'Invalid email address',
    });
  }

  if (selected.has('url')) {
    url = await promptText(flow, {
      message: 'Author URL (leave blank to omit):',
      default: urlSuggestion,
    });
    url = url.trim();
  }

  return { name, email, url };
}
