export function skillAttribute(system, skillKey, defaultAttribute) {
  const selected = system.skillAttributes?.[skillKey];
  return typeof selected === "string" && Object.hasOwn(globalThis.CONFIG?.DBU?.attributes || {}, selected)
    ? selected : defaultAttribute;
}
