import {
  collectVSCodeLanguageOrder,
  isVSCodeLanguageBlockKey,
  VSCODE_SETTINGS_GROUPS,
  VSCODE_SETTINGS_GROUP_KEY_SET,
} from './vscode-settings.groups.js';

type VSCodeSettingsData = Record<string, unknown>;

interface VSCodeSettingsRenderOptions {
  languageOrder?: readonly string[];
  pruneExactKeys?: readonly string[];
  prunePrefixes?: readonly string[];
}

function renderSettingEntry(key: string, value: unknown): string {
  if (
    Array.isArray(value) &&
    value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))
  ) {
    return `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  }

  const renderedValue = JSON.stringify(value, null, 2);
  const lines = renderedValue.split('\n');

  if (lines.length === 1) {
    return `  ${JSON.stringify(key)}: ${lines[0]}`;
  }

  return [`  ${JSON.stringify(key)}: ${lines[0]}`, ...lines.slice(1).map((line) => `  ${line}`)].join('\n');
}

function normalizeLanguageOrder(settings: VSCodeSettingsData, languageOrder: readonly string[]): string[] {
  const desiredBlockKeys = languageOrder.map((language) => `[${language}]`);
  const presentLanguageKeys = Object.keys(settings).filter(
    (key): key is string => key.startsWith('[') && key.endsWith(']'),
  );
  const remaining = presentLanguageKeys.filter((key) => !desiredBlockKeys.includes(key)).toSorted();

  return [...desiredBlockKeys.filter((key) => presentLanguageKeys.includes(key)), ...remaining];
}

export function normalizeVSCodeSettingsObject(
  settings: VSCodeSettingsData,
  options: VSCodeSettingsRenderOptions = {},
): VSCodeSettingsData {
  const { pruneExactKeys = [], prunePrefixes = [] } = options;
  const next: VSCodeSettingsData = {};

  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) {
      continue;
    }
    if (pruneExactKeys.includes(key)) {
      continue;
    }
    if (prunePrefixes.some((prefix) => key.startsWith(prefix))) {
      continue;
    }
    next[key] = value;
  }

  return next;
}

export function renderGroupedVSCodeSettingsJson(
  settings: VSCodeSettingsData,
  options: VSCodeSettingsRenderOptions = {},
): string {
  const normalized = normalizeVSCodeSettingsObject(settings, options);
  const groups: string[][] = [];

  for (const group of VSCODE_SETTINGS_GROUPS) {
    if (group.id === 'languageFormatters') {
      const languageKeys = normalizeLanguageOrder(
        normalized,
        options.languageOrder ?? collectVSCodeLanguageOrder(normalized),
      );
      const entries = languageKeys
        .filter((key) => normalized[key] !== undefined)
        .map((key) => renderSettingEntry(key, normalized[key]));
      if (entries.length > 0) {
        groups.push(entries);
      }
      continue;
    }

    const entries = group.keys
      .filter((key) => normalized[key] !== undefined)
      .map((key) => renderSettingEntry(key, normalized[key]));

    if (entries.length > 0) {
      groups.push(entries);
    }
  }

  const unknownRootKeys = Object.keys(normalized)
    .filter((key) => !VSCODE_SETTINGS_GROUP_KEY_SET.has(key) && !isVSCodeLanguageBlockKey(key))
    .toSorted();

  if (unknownRootKeys.length > 0) {
    const unknownEntries = unknownRootKeys.map((key) => renderSettingEntry(key, normalized[key]));
    const markdownIndex = groups.findIndex((entries) =>
      entries.some((entry) => entry.includes('"markdownlint.config"') || entry.includes('"markdown.styles"')),
    );

    if (markdownIndex === -1) {
      groups.push(unknownEntries);
    } else {
      groups.splice(markdownIndex, 0, unknownEntries);
    }
  }

  const body = groups.map((entries) => entries.join(',\n')).join(',\n\n');
  return `{\n${body}\n}\n`;
}
