import * as p from '@clack/prompts';

export function renderHelp(title: string, sections: Array<{ title: string; body: string }>): void {
  console.clear();
  p.intro(title);

  for (const section of sections) {
    p.note(section.body, section.title);
  }

  p.outro('Use --help with a command for more details');
}
