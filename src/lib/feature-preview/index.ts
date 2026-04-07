export {
  applyPreviewChanges,
  createDeletePreviewChange,
  createRenameBackupPreviewChange,
  createWritePreviewChange,
  getChangedPreviewChanges,
  hasPreviewChanges,
  isPreviewChangeChanged,
  resolveFirstAvailableRenameBackupPath,
} from './feature-preview.utils.js';
export type {
  FeatureApplyResult,
  FeaturePreviewChange,
  FeaturePreviewChangeDelete,
  FeaturePreviewChangeRenameBackup,
  FeaturePreviewChangeWrite,
  FeaturePreviewResult,
} from './feature-preview.types.js';
