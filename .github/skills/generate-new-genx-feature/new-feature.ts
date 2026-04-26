#!/usr/bin/env tsx

/**
 * Scaffold a new feature module for @finografic/genx.
 *
 * Usage: pnpm dev:feature
 *
 * Creates the feature folder, skeleton files, and wires the registry + FeatureId type.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import * as clack from '@clack/prompts';

import { ensureDir, fileExists } from '../../../src/utils/fs.utils';
import { pc } from '../../../src/utils/picocolors';
import { applyTemplate } from '../../../src/utils/template.utils';

/* ────────────────────────────────────────────────────────── */
/* Helpers                                                     */
/* ────────────────────────────────────────────────────────── */

/** Convert camelCase to kebab-case (e.g. `gitHooks` → `git-hooks`) */
function toKebab(camel: string): string {
  return camel.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Convert camelCase to PascalCase (e.g. `gitHooks` → `GitHooks`) */
function toPascal(camel: string): string {
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** Check if a FeatureId already exists in the type union */
async function isFeatureIdTaken(id: string): Promise<boolean> {
  const typesPath = resolve('src/features/feature.types.ts');
  const content = await readFile(typesPath, 'utf8');
  return content.includes(`'${id}'`);
}

/* ────────────────────────────────────────────────────────── */
/* Main                                                       */
/* ────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  clack.intro(pc.bgCyan(pc.black(' genx · scaffold feature ')));

  /* ── Feature ID ── */

  const featureId = await clack.text({
    message: 'Feature ID (camelCase)',
    placeholder: 'e.g. tailwind, reactRouter, githubWorkflow',
    validate(value) {
      const trimmed = value?.trim() ?? '';
      if (!trimmed) return 'Feature ID is required';
      if (!/^[a-z][a-zA-Z]*$/.test(trimmed)) {
        return 'Must be camelCase (e.g. tailwind, gitHooks)';
      }
      return undefined;
    },
  });

  if (clack.isCancel(featureId)) {
    clack.cancel('Operation cancelled');
    return;
  }

  // Check for duplicates
  if (await isFeatureIdTaken(featureId)) {
    clack.log.error(pc.red(`Feature ID '${featureId}' already exists in FeatureId type.`));
    clack.cancel('Operation cancelled');
    return;
  }

  /* ── Feature Label ── */

  const featureLabel = await clack.text({
    message: 'Feature label (display name for prompts)',
    placeholder: 'e.g. Tailwind CSS, React Router',
    validate(value) {
      const trimmed = value?.trim() ?? '';
      if (!trimmed) return 'Label is required';
      return undefined;
    },
  });

  if (clack.isCancel(featureLabel)) {
    clack.cancel('Operation cancelled');
    return;
  }

  /* ── Hint ── */

  const hint = await clack.select({
    message: 'Prompt hint',
    options: [
      { value: '', label: 'None' },
      { value: 'recommended', label: 'recommended' },
      { value: 'optional', label: 'optional' },
    ],
  });

  if (clack.isCancel(hint)) {
    clack.cancel('Operation cancelled');
    return;
  }

  /* ── VSCode file? ── */

  const needsVscode = await clack.confirm({
    message: 'Does this feature need a .vscode.ts file?',
    initialValue: false,
  });

  if (clack.isCancel(needsVscode)) {
    clack.cancel('Operation cancelled');
    return;
  }

  /* ────────────────────────────────────────────────────────── */
  /* Derive values                                               */
  /* ────────────────────────────────────────────────────────── */

  const folderName = toKebab(featureId);
  const pascalName = toPascal(featureId);
  const featureDir = resolve('src/features', folderName);

  if (fileExists(featureDir)) {
    clack.log.error(pc.red(`Directory already exists: src/features/${folderName}`));
    clack.cancel('Operation cancelled');
    return;
  }

  const vars: Record<string, string> = {
    FEATURE_ID: featureId,
    FEATURE_LABEL: featureLabel,
    FEATURE_PASCAL: pascalName,
    FOLDER_NAME: folderName,
  };

  /* ────────────────────────────────────────────────────────── */
  /* Scaffold from templates                                     */
  /* ────────────────────────────────────────────────────────── */

  const spin = clack.spinner();
  spin.start('Scaffolding feature files...');

  await ensureDir(featureDir);

  const templateDir = resolve('.github/skills/generate-new-genx-feature/feature-template');
  const templateFiles = await readdir(templateDir);

  for (const templateFile of templateFiles) {
    const srcPath = resolve(templateDir, templateFile);

    // Replace __FOLDER_NAME__ in the filename; strip `.template` from repo template names
    let destFileName = templateFile.replace(/__FOLDER_NAME__/g, folderName);
    if (destFileName.endsWith('.template')) {
      destFileName = destFileName.slice(0, -'.template'.length);
    }
    const destPath = resolve(featureDir, destFileName);

    const content = await readFile(srcPath, 'utf8');
    const rendered = applyTemplate(content, vars);
    await writeFile(destPath, rendered, 'utf8');
  }

  // Patch hint in .feature.ts if a value was chosen
  if (hint) {
    const featureFilePath = resolve(featureDir, `${folderName}.feature.ts`);
    let featureContent = await readFile(featureFilePath, 'utf8');
    featureContent = featureContent.replace('hint: undefined,', `hint: '${hint}',`);
    await writeFile(featureFilePath, featureContent, 'utf8');
  }

  spin.stop('Feature files created');

  /* ── Optional: VSCode file ── */

  if (needsVscode) {
    const vscodePath = resolve(featureDir, `${folderName}.vscode.ts`);
    const vscodeContent = `import { addExtensionRecommendations } from 'utils';

/**
 * Apply ${featureLabel} VSCode extension recommendations.
 */
export async function apply${pascalName}Extensions(targetDir: string): Promise<string[]> {
  // TODO: Import extensions array from constants
  return addExtensionRecommendations(targetDir, []);
}
`;
    await writeFile(vscodePath, vscodeContent, 'utf8');
    clack.log.success(pc.green(`Created ${folderName}.vscode.ts`));
  }

  /* ────────────────────────────────────────────────────────── */
  /* Wire FeatureId type                                         */
  /* ────────────────────────────────────────────────────────── */

  spin.start('Updating FeatureId type...');

  const typesPath = resolve('src/features/feature.types.ts');
  let typesContent = await readFile(typesPath, 'utf8');

  // Insert before the closing semicolon of the FeatureId union
  // Find the last existing entry and add after it
  const unionEntryRegex = /(\| '[a-zA-Z]+')\s*;/;
  const unionMatch = typesContent.match(unionEntryRegex);

  if (unionMatch) {
    typesContent = typesContent.replace(unionEntryRegex, `$1\n  | '${featureId}';`);
    await writeFile(typesPath, typesContent, 'utf8');
  }

  spin.stop('FeatureId type updated');

  /* ────────────────────────────────────────────────────────── */
  /* Wire feature registry                                       */
  /* ────────────────────────────────────────────────────────── */

  spin.start('Updating feature registry...');

  const registryPath = resolve('src/features/feature-registry.ts');
  let registryContent = await readFile(registryPath, 'utf8');

  // Add import — find the last feature import and insert after it
  const lastImportRegex = /(import \{ \w+Feature \} from '[^']+';)\n(import type)/;
  const lastImportMatch = registryContent.match(lastImportRegex);

  if (lastImportMatch) {
    const newImport = `import { ${featureId}Feature } from './${folderName}/${folderName}.feature';`;
    registryContent = registryContent.replace(lastImportRegex, `$1\n${newImport}\n$2`);
  }

  // Add to features array — insert before the closing bracket
  const arrayEndRegex = /(\w+Feature),\n\];/;
  const arrayMatch = registryContent.match(arrayEndRegex);

  if (arrayMatch) {
    registryContent = registryContent.replace(arrayEndRegex, `$1,\n  ${featureId}Feature,\n];`);
  }

  await writeFile(registryPath, registryContent, 'utf8');

  spin.stop('Feature registry updated');

  /* ────────────────────────────────────────────────────────── */
  /* Summary                                                     */
  /* ────────────────────────────────────────────────────────── */

  clack.note(
    [
      pc.cyan('src/features/' + folderName + '/'),
      '',
      `  ${folderName}.feature.ts`,
      `  ${folderName}.detect.ts`,
      `  ${folderName}.apply.ts`,
      `  ${folderName}.constants.ts`,
      needsVscode ? `  ${folderName}.vscode.ts` : null,
      '  README.md',
      '',
      pc.cyan('Updated:'),
      `  src/features/feature.types.ts   ${pc.dim('(FeatureId union)')}`,
      `  src/features/feature-registry.ts ${pc.dim('(import + array entry)')}`,
    ]
      .filter(Boolean)
      .join('\n'),
    `Feature scaffolded: ${featureLabel}`,
  );

  clack.outro(pc.green(`Next: implement the TODO stubs in src/features/${folderName}/`));
}

/* ────────────────────────────────────────────────────────── */
/* Bootstrap                                                    */
/* ────────────────────────────────────────────────────────── */

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
