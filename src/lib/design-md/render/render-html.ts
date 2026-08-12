import type { ParsedDesignMd, RawDesignTokens, RawTypographyToken } from '../design-md.types.js';

/**
 * Render a DESIGN.md into a single self-contained HTML preview: color
 * swatches, typography specimens, spacing/radius scales, component token
 * cards, and the prose body. Generated artifact — never hand-maintained.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Resolve `{group.token}` references against the raw token tree (one level deep). */
function resolveRef(value: string, tokens: RawDesignTokens): string {
  const match = value.match(/^\{(\w+)\.(.+)\}$/);
  if (!match) {
    return value;
  }
  const group = (tokens as Record<string, unknown>)[match[1] ?? ''];
  if (group && typeof group === 'object') {
    const resolved = (group as Record<string, unknown>)[match[2] ?? ''];
    if (typeof resolved === 'string' || typeof resolved === 'number') {
      return String(resolved);
    }
  }
  return value;
}

function isColorValue(value: string): boolean {
  return /^(#|rgb|hsl|oklch|oklab|color\()/.test(value.trim());
}

function renderColors(colors: Record<string, string>): string {
  const swatches = Object.entries(colors)
    .map(([name, value]) => {
      const bg = isColorValue(value) ? value : 'transparent';
      return (
        `<div class="swatch"><div class="chip" style="background:${escapeHtml(bg)}"></div>` +
        `<code>${escapeHtml(name)}</code><span>${escapeHtml(value)}</span></div>`
      );
    })
    .join('\n');
  return `<section><h2>Colors</h2><div class="swatches">${swatches}</div></section>`;
}

function renderTypography(typography: Record<string, RawTypographyToken>): string {
  const specimens = Object.entries(typography)
    .map(([name, style]) => {
      const css = [
        style.fontFamily && `font-family:${style.fontFamily}`,
        style.fontSize && `font-size:${style.fontSize}`,
        style.fontWeight !== undefined && `font-weight:${style.fontWeight}`,
        style.lineHeight !== undefined && `line-height:${style.lineHeight}`,
        style.letterSpacing && `letter-spacing:${style.letterSpacing}`,
      ]
        .filter(Boolean)
        .join(';');
      const meta = [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight]
        .filter((v) => v !== undefined)
        .join(' · ');
      return (
        `<div class="specimen"><code>${escapeHtml(name)}</code>` +
        `<p style="${escapeHtml(css)}">The quick brown fox jumps over the lazy dog</p>` +
        `<span>${escapeHtml(meta)}</span></div>`
      );
    })
    .join('\n');
  return `<section><h2>Typography</h2>${specimens}</section>`;
}

function renderScale(
  title: string,
  entries: Record<string, string | number>,
  kind: 'radius' | 'spacing',
): string {
  const items = Object.entries(entries)
    .map(([name, value]) => {
      const size = typeof value === 'number' ? `${value}px` : value;
      const demo =
        kind === 'radius'
          ? `<div class="radius-demo" style="border-radius:${escapeHtml(size)}"></div>`
          : `<div class="spacing-demo" style="width:${escapeHtml(size)}"></div>`;
      return `<div class="scale-item">${demo}<code>${escapeHtml(name)}</code><span>${escapeHtml(String(value))}</span></div>`;
    })
    .join('\n');
  return `<section><h2>${escapeHtml(title)}</h2><div class="scale">${items}</div></section>`;
}

function renderComponents(
  components: Record<string, Record<string, string>>,
  tokens: RawDesignTokens,
): string {
  const cards = Object.entries(components)
    .map(([name, props]) => {
      const bg = props.backgroundColor ? resolveRef(props.backgroundColor, tokens) : undefined;
      const color = props.textColor ? resolveRef(props.textColor, tokens) : undefined;
      const radius = props.rounded ? resolveRef(props.rounded, tokens) : undefined;
      const padding = props.padding ? resolveRef(props.padding, tokens) : undefined;
      const demoCss = [
        bg && `background:${bg}`,
        color && `color:${color}`,
        radius && `border-radius:${radius}`,
        padding && `padding:${padding}`,
      ]
        .filter(Boolean)
        .join(';');
      const rows = Object.entries(props)
        .map(
          ([prop, value]) =>
            `<tr><td>${escapeHtml(prop)}</td><td><code>${escapeHtml(value)}</code></td></tr>`,
        )
        .join('');
      return (
        `<div class="component-card"><h3>${escapeHtml(name)}</h3>` +
        `<div class="component-demo"><span style="${escapeHtml(demoCss)}">${escapeHtml(name)}</span></div>` +
        `<table>${rows}</table></div>`
      );
    })
    .join('\n');
  return `<section><h2>Components</h2><div class="components">${cards}</div></section>`;
}

/** Minimal markdown → HTML for the prose body (headings, lists, emphasis, code). */
function renderMarkdown(markdown: string): string {
  const inline = (text: string): string =>
    escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const html: string[] = [];
  let inList = false;
  const closeList = (): void => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const line of markdown.split('\n')) {
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (heading?.[1] && heading[2] !== undefined) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (listItem?.[1] !== undefined) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inline(listItem[1])}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return html.join('\n');
}

const STYLES = `
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 960px; padding: 2rem 1.5rem 4rem; line-height: 1.55; }
  h1 { font-size: 1.6rem; } h2 { margin-top: 2.2rem; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); padding-bottom: .3rem; }
  code { font-family: ui-monospace, monospace; font-size: .85em; background: color-mix(in srgb, currentColor 8%, transparent); padding: .1em .35em; border-radius: 4px; }
  .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .8rem; }
  .swatch { display: flex; flex-direction: column; gap: .25rem; font-size: .8rem; }
  .swatch .chip { height: 56px; border-radius: 8px; border: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
  .specimen { margin: 1rem 0; } .specimen p { margin: .25rem 0; } .specimen span { font-size: .75rem; opacity: .7; }
  .scale { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-end; }
  .scale-item { display: flex; flex-direction: column; gap: .3rem; font-size: .78rem; align-items: flex-start; }
  .radius-demo { width: 56px; height: 56px; background: color-mix(in srgb, currentColor 22%, transparent); }
  .spacing-demo { height: 14px; background: color-mix(in srgb, currentColor 32%, transparent); border-radius: 3px; }
  .components { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
  .component-card { border: 1px solid color-mix(in srgb, currentColor 15%, transparent); border-radius: 10px; padding: 1rem; }
  .component-card h3 { margin: 0 0 .6rem; font-size: .95rem; }
  .component-demo { margin-bottom: .6rem; } .component-demo span { display: inline-block; padding: .5rem 1rem; }
  .component-card table { font-size: .78rem; border-collapse: collapse; width: 100%; }
  .component-card td { padding: .15rem .4rem .15rem 0; vertical-align: top; }
  .prose { margin-top: 3rem; border-top: 2px solid color-mix(in srgb, currentColor 15%, transparent); padding-top: 1rem; }
  .generated { font-size: .75rem; opacity: .6; }
`;

export function renderDesignHtml(parsed: ParsedDesignMd): string {
  const { tokens } = parsed;
  const sections: string[] = [];

  sections.push(`<h1>${escapeHtml(tokens.name ?? 'Design System')}</h1>`);
  sections.push(
    '<p class="generated">Generated by <code>genx design render</code> — do not edit; the source of truth is DESIGN.md.</p>',
  );
  if (tokens.description) {
    sections.push(`<p>${escapeHtml(tokens.description)}</p>`);
  }
  if (tokens.colors && Object.keys(tokens.colors).length > 0) {
    sections.push(renderColors(tokens.colors));
  }
  if (tokens.typography && Object.keys(tokens.typography).length > 0) {
    sections.push(renderTypography(tokens.typography));
  }
  if (tokens.rounded && Object.keys(tokens.rounded).length > 0) {
    sections.push(renderScale('Shapes (rounded)', tokens.rounded, 'radius'));
  }
  if (tokens.spacing && Object.keys(tokens.spacing).length > 0) {
    sections.push(renderScale('Spacing', tokens.spacing, 'spacing'));
  }
  if (tokens.components && Object.keys(tokens.components).length > 0) {
    sections.push(renderComponents(tokens.components, tokens));
  }
  sections.push(`<div class="prose">${renderMarkdown(parsed.body)}</div>`);

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(tokens.name ?? 'Design System')} — DESIGN.md preview</title>`,
    `<style>${STYLES}</style>`,
    '</head>',
    '<body>',
    ...sections,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
