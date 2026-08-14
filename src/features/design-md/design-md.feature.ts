import type { Feature } from '../feature.types';

import { applyDesignMd } from './design-md.apply';
import { auditDesignMd, detectDesignMd, isDesignMdApplicable } from './design-md.detect';

/**
 * DESIGN.md token mirror. Detection-first: audit reports presence and drift
 * against the canonical design system, and apply only ever refreshes an
 * existing mirror — never authors one.
 */
export const designMdFeature: Feature = {
  id: 'designMd',
  label: 'DESIGN.md (design token mirror)',
  description: 'Mirrors design-system tokens for agent consumption',
  applicable: isDesignMdApplicable,
  detect: detectDesignMd,
  audit: auditDesignMd,
  apply: applyDesignMd,
};
