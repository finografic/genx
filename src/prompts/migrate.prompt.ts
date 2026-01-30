import * as clack from '@clack/prompts';
import * as pc from 'picocolors';

import { cancel } from 'utils/prompts.utils';

export async function confirmMigrateTarget(pkg: {
  scope: string;
  name: string;
  expectedScope: string;
}): Promise<boolean | null> {
  if (pkg.scope === pkg.expectedScope) return true;

  const ok = await clack.confirm({
    message: `Detected package: ${pc.cyan(`${pkg.scope}/${pkg.name}`)}. Continue?`,
    initialValue: true,
  });

  if (clack.isCancel(ok) || ok === false) return cancel();
  return true;
}

export async function confirmNodeVersionUpgrade(params: {
  from: number;
  to: number;
  nvmrc: string;
}): Promise<boolean | null> {
  const ok = await clack.confirm({
    message: `Detected Node v${params.from} → migrate runtime to ${pc.cyan(params.nvmrc)}?`,
    initialValue: true,
  });

  if (clack.isCancel(ok) || ok === false) return cancel();
  return true;
}

export async function confirmMerges(files: Array<{ file: string }>): Promise<boolean | null> {
  const fileList = files.map((f) => pc.cyan(f.file)).join(', ');
  const ok = await clack.confirm({
    message: `The following ${files.length} file(s) will be merged: ${fileList}. Continue?`,
    initialValue: true,
  });

  if (clack.isCancel(ok) || ok === false) return cancel();
  return true;
}

export async function confirmReleasesRename(): Promise<boolean | null> {
  const ok = await clack.confirm({
    message: `Rename ${pc.yellow('docs/RELEASES.md')} ${pc.white('to')} ${
      pc.greenBright('docs/process/RELEASE_PROCESS.md')
    }${pc.white('?')}`,
    initialValue: true,
  });

  if (clack.isCancel(ok) || ok === false) return cancel();
  return true;
}
