export const sizeCategories = ['nano', 'tiny', 'small', 'medium', 'large', 'enormous', 'gigantic', 'colossal'];
export function sizeRank(actor) {
  return sizeCategories.indexOf(actor?.system?.status?.currentSize || actor?.system?.baseSize);
}
export function sizeLead(actor, other) {
  const a = sizeRank(actor), b = sizeRank(other);
  return actor?.system?.rulesVersion === '0.9.3' && a >= 0 && b >= 0 ? a - b : 0;
}
