import { MultiSelectPrompt, wrapTextWithPrefix } from '@clack/core';
import {
  MULTISELECT_INSTRUCTIONS,
  S_BAR,
  S_BAR_END,
  S_CHECKBOX_ACTIVE,
  S_CHECKBOX_INACTIVE,
  S_CHECKBOX_SELECTED,
  formatInstructionFooter,
  isCancel,
  limitOptions,
  symbol,
  symbolBar,
} from '@clack/prompts';

import { pc } from 'utils/picocolors';

export interface StyledMultiSelectRowState {
  disabled: boolean;
  /** The row the cursor is currently on. */
  focused: boolean;
  selected: boolean;
  /** Rendering the final summary after submit, rather than a live row. */
  submitted: boolean;
}

export interface StyledMultiSelectOption<Value> {
  /** Whether the row is shown but cannot be toggled. */
  disabled?: boolean;
  hint?: string;
  /** Plain, uncolored text. Used verbatim when no `style` is given. */
  label: string;
  /**
   * Full control over the row text per state — return the colored string.
   * Lets a caller tint parts of a row differently (and differently again when focused).
   */
  style?: (state: StyledMultiSelectRowState) => string;
  value: Value;
}

/**
 * Multi-select with per-row-state styling.
 *
 * `@clack/prompts` `multiselect` hardcodes its label styler (it wraps every unfocused
 * row in `dim`, which mutes any color the caller applied), and exposes no styling hook.
 * This builds the same prompt on `MultiSelectPrompt` + the exported `limitOptions`,
 * whose `style(option, active)` callback gives us the control we need.
 *
 * Each option supplies its own `style(state)`, so callers can tint parts of a row
 * independently and vary that tint by focus/selection. Only the checkbox glyph is
 * owned here: cyan when focused, green when selected, dim green when disabled.
 *
 * Returns `null` when the user cancels.
 */
export async function promptStyledMultiSelect<Value>(config: {
  initialValues?: Value[];
  maxItems?: number;
  message: string;
  /** Require at least one selection before the prompt will submit. */
  minOne?: boolean;
  options: Array<StyledMultiSelectOption<Value>>;
}): Promise<Value[] | null> {
  const required = config.minOne ?? false;

  const renderHint = (option: StyledMultiSelectOption<Value>): string =>
    option.hint ? ` ${pc.dim(`(${option.hint})`)}` : '';

  /** Row text for a given state — the option's own `style` wins, else the plain label. */
  const renderText = (option: StyledMultiSelectOption<Value>, state: StyledMultiSelectRowState): string =>
    option.style?.(state) ?? option.label;

  const renderCheckbox = (state: StyledMultiSelectRowState): string => {
    if (state.disabled) return pc.dim(pc.green(S_CHECKBOX_INACTIVE));
    if (state.focused) {
      return pc.cyan(state.selected ? S_CHECKBOX_SELECTED : S_CHECKBOX_ACTIVE);
    }
    return state.selected ? pc.green(S_CHECKBOX_SELECTED) : pc.dim(S_CHECKBOX_INACTIVE);
  };

  const renderRow = (option: StyledMultiSelectOption<Value>, state: StyledMultiSelectRowState): string =>
    `${renderCheckbox(state)} ${renderText(option, state)}${renderHint(option)}`;

  /**
   * One entry per line under the guide bar. Clack's own multiselect joins the summary
   * with commas, which reflows into an unreadable paragraph once a dozen targets are
   * selected — a vertical list stays scannable.
   */
  const asSummaryLines = (entries: string[]): string =>
    entries.map((entry) => `${pc.gray(S_BAR)}  ${entry}`).join('\n');

  /** Flat, checkbox-less rendering for the submitted / cancelled summary lines. */
  const renderSummaryEntry = (option: StyledMultiSelectOption<Value>, cancelled: boolean): string => {
    const text = renderText(option, {
      disabled: false,
      focused: false,
      selected: true,
      submitted: true,
    });
    return cancelled ? pc.strikethrough(pc.dim(option.label)) : text;
  };

  const prompt = new MultiSelectPrompt<StyledMultiSelectOption<Value>>({
    options: config.options,
    initialValues: config.initialValues,
    required,
    validate(value) {
      if (required && (value === undefined || value.length === 0)) {
        return 'Please select at least one option.';
      }
      return undefined;
    },
    render() {
      const selectedValues = this.value ?? [];

      const header = `${pc.gray(S_BAR)}\n${wrapTextWithPrefix(
        undefined,
        config.message,
        `${symbolBar(this.state)}  `,
        `${symbol(this.state)}  `,
      )}\n`;

      const styleRow = (option: StyledMultiSelectOption<Value>, active: boolean): string =>
        renderRow(option, {
          disabled: option.disabled ?? false,
          focused: active && !option.disabled,
          selected: selectedValues.includes(option.value),
          submitted: false,
        });

      const selectedOptions = this.options.filter((option) => selectedValues.includes(option.value));

      switch (this.state) {
        case 'submit': {
          const entries = selectedOptions.map((option) => renderSummaryEntry(option, false));
          return `${header}${asSummaryLines(entries.length > 0 ? entries : [pc.dim('none')])}`;
        }
        case 'cancel': {
          const entries = selectedOptions.map((option) => renderSummaryEntry(option, true));
          if (entries.length === 0) return `${header}${pc.gray(S_BAR)}`;
          return `${header}${asSummaryLines(entries)}\n${pc.gray(S_BAR)}`;
        }
        case 'error': {
          const columnPrefix = `${pc.yellow(S_BAR)}  `;
          const errorLines = this.error
            .split('\n')
            .map((line, index) =>
              index === 0 ? `${pc.yellow(S_BAR_END)}  ${pc.yellow(line)}` : `   ${line}`,
            )
            .join('\n');
          const rows = limitOptions({
            options: this.options,
            cursor: this.cursor,
            maxItems: config.maxItems,
            columnPadding: columnPrefix.length,
            rowPadding: header.split('\n').length + errorLines.split('\n').length + 1,
            style: styleRow,
          });
          return `${header}${columnPrefix}${rows.join(`\n${columnPrefix}`)}\n${errorLines}\n`;
        }
        default: {
          const columnPrefix = `${pc.cyan(S_BAR)}  `;
          const footerLines = formatInstructionFooter(MULTISELECT_INSTRUCTIONS, true);
          const rows = limitOptions({
            options: this.options,
            cursor: this.cursor,
            maxItems: config.maxItems,
            columnPadding: columnPrefix.length,
            rowPadding: header.split('\n').length + footerLines.length + 1,
            style: styleRow,
          });
          return `${header}${columnPrefix}${rows.join(`\n${columnPrefix}`)}\n${footerLines.join('\n')}\n`;
        }
      }
    },
  });

  const result = await prompt.prompt();
  if (isCancel(result)) return null;
  return result ?? [];
}
