import pc from 'picocolors';

export function renderMainSignature(main: { bin: string; args?: string; }): string {
  return (
    pc.bold(pc.cyanBright(main.bin)) +
    (main.args ? ` ${pc.bold(pc.whiteBright(main.args))}` : '')
  );
}
