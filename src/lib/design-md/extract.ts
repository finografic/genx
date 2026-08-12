import type { DesignSystemFramework, DetectedDesignSystem, ExtractedTokens } from './design-md.types.js';

import { detectDesignSystems } from './extractors/detect.js';
import { extractPandacssTokens } from './extractors/pandacss.extractor.js';
import { extractTailwind4Tokens } from './extractors/tailwind4.extractor.js';

export interface ExtractionResult {
  detected: DetectedDesignSystem;
  extracted: ExtractedTokens;
}

/**
 * Detect the project's design system and extract its tokens.
 * Returns null when no supported design system is present.
 * `framework` forces a specific extractor when a project has several.
 */
export async function extractFromProject(
  targetDir: string,
  options: { framework?: DesignSystemFramework } = {},
): Promise<ExtractionResult | null> {
  const detectedSystems = detectDesignSystems(targetDir);
  const detected = options.framework
    ? detectedSystems.find((d) => d.framework === options.framework)
    : detectedSystems[0];

  if (!detected) {
    return null;
  }

  if (detected.framework === 'pandacss') {
    const configFile = detected.sourceFiles[0];
    if (!configFile) {
      return null;
    }
    return { detected, extracted: await extractPandacssTokens(targetDir, configFile) };
  }

  return { detected, extracted: extractTailwind4Tokens(targetDir, detected.sourceFiles) };
}
