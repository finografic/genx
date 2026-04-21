import { oxlintConfig } from '@finografic/oxc-config';
import { configOverrides, testOverrides } from '@finografic/oxc-config/oxlint';
import { defineConfig } from 'oxlint';
import type { OxlintConfig } from 'oxlint';

export default defineConfig({
  ...oxlintConfig,
  overrides: [configOverrides, testOverrides],
} satisfies OxlintConfig);
