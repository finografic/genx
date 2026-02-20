/**
 * Generates the content of a `src/{binName}.help.ts` file for CLI packages.
 * The output follows the standard @finografic CLI help format.
 */
export function generateCliHelpContent(binName: string): string {
  return `import pc from 'picocolors';

export function printHelp(): void {
  const lines: string[] = [];

  lines.push('');
  lines.push(\`\${pc.bold('${binName}')} - TODO: describe your CLI tool\`);
  lines.push('');

  lines.push(pc.bold('USAGE'));
  lines.push(\`  \${pc.cyanBright('${binName}')} \${pc.dim(pc.cyan('<command>'))} [options]\`);
  lines.push('');

  lines.push(pc.bold('COMMANDS'));
  const commands = [
    { name: 'TODO', desc: 'Add your commands here' },
  ];
  const maxNameLength = Math.max(...commands.map((c) => c.name.length));
  for (const cmd of commands) {
    lines.push(\`  \${pc.cyan(cmd.name)}\${' '.repeat(maxNameLength - cmd.name.length + 4)}\${cmd.desc}\`);
  }
  lines.push('');

  lines.push(pc.bold('OPTIONS'));
  lines.push('  -h, --help       Show help for a command');
  lines.push('  -v, --version    Show version number');
  lines.push('');

  lines.push(pc.bold('EXAMPLES'));
  const examples = [
    { cmd: '${binName} TODO', comment: 'TODO: describe this example' },
  ];
  const maxCmdLength = Math.max(...examples.map((e) => e.cmd.length));
  for (const ex of examples) {
    lines.push(\`  \${ex.cmd}\${' '.repeat(maxCmdLength - ex.cmd.length + 4)}\${pc.dim('# ' + ex.comment)}\`);
  }
  lines.push('');

  lines.push(pc.bold('GET HELP'));
  lines.push(\`  \${pc.cyanBright('${binName}')} \${pc.dim(pc.cyan('<command>'))} --help       \${pc.dim('# Show detailed help for a command')}\`);
  lines.push('');

  console.log(lines.join('\\n'));
}
`;
}

/**
 * Extracts the binary name from a package.json `bin` field.
 * Falls back to the provided `fallback` name if not found.
 */
export function getBinName(packageJson: Record<string, unknown>, fallback: string): string {
  const bin = packageJson['bin'];
  if (typeof bin === 'object' && bin !== null && !Array.isArray(bin)) {
    const keys = Object.keys(bin as Record<string, string>);
    if (keys.length > 0 && keys[0]) return keys[0];
  }
  return fallback;
}

/**
 * Returns true if the package has the `genx:type:cli` keyword.
 */
export function isCliPackage(packageJson: Record<string, unknown>): boolean {
  const keywords = packageJson['keywords'];
  if (!Array.isArray(keywords)) return false;
  return keywords.some((k) => k === 'genx:type:cli');
}
