import type { ReactNode } from "react";

const ELEMENT_TYPES = new Set([Symbol.for("react.transitional.element"), Symbol.for("react.element")]);
const FRAGMENT = Symbol.for("react.fragment");

const CASE_SENSITIVE_ATTRIBUTES = new Set(["viewBox", "preserveAspectRatio", "gradientUnits", "gradientTransform"]);
const UNSUPPORTED_PROPS = new Set(["className", "style", "dangerouslySetInnerHTML", "ref"]);

interface ElementLike {
  $$typeof: symbol;
  type: unknown;
  props: Record<string, unknown> & { children?: ReactNode };
}

function isElement(node: unknown): node is ElementLike {
  return typeof node === "object" && node !== null && ELEMENT_TYPES.has((node as ElementLike).$$typeof);
}

export function escapeMarkup(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#x27;",
  );
}

function attributeName(prop: string): string {
  if (CASE_SENSITIVE_ATTRIBUTES.has(prop) || prop.startsWith("aria-") || prop.startsWith("data-")) return prop;
  return prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function serializeAttributes(props: ElementLike["props"]): string {
  let out = "";
  for (const [prop, value] of Object.entries(props)) {
    if (prop === "children" || value === undefined || value === null) continue;
    if (UNSUPPORTED_PROPS.has(prop) || /^on[A-Z]/.test(prop) || typeof value === "function") {
      throw new Error(`svg-markup: unsupported prop "${prop}" in a static renderer`);
    }
    if (typeof value === "boolean") {
      if (!prop.startsWith("aria-")) throw new Error(`svg-markup: boolean prop "${prop}" is not supported`);
    }
    if (typeof value === "object") throw new Error(`svg-markup: object value for prop "${prop}"`);
    out += ` ${attributeName(prop)}="${escapeMarkup(String(value))}"`;
  }
  return out;
}

export function renderSvgMarkup(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return escapeMarkup(node);
  if (typeof node === "number" || typeof node === "bigint") return escapeMarkup(String(node));
  if (Array.isArray(node)) return node.map(renderSvgMarkup).join("");
  if (!isElement(node)) throw new Error("svg-markup: unsupported node (portals, promises and lazy are not allowed)");

  const { type, props } = node;
  if (type === FRAGMENT) return renderSvgMarkup(props.children);
  if (typeof type === "function") {
    return renderSvgMarkup((type as (p: unknown) => ReactNode)(props));
  }
  if (typeof type !== "string") throw new Error("svg-markup: unsupported element type");

  return `<${type}${serializeAttributes(props)}>${renderSvgMarkup(props.children)}</${type}>`;
}
