type Child = Node | string | number | false | null | undefined;

/** Minimal element builder. Text goes in as text nodes, never as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) if (v !== undefined) el.setAttribute(k, v);
  for (const c of children) if (c !== false && c != null) el.append(typeof c === 'number' ? String(c) : c);
  return el;
}

const SVG = 'http://www.w3.org/2000/svg';
export type IconName = 'flag' | 'mine' | 'bulb' | 'clock' | 'sound' | 'mute';

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

export const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
