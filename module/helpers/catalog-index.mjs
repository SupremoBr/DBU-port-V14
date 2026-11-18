/** Shared indexes for session catalogs, never for mutable actor data.
 * Replace a catalog to rebuild automatically. After an in-place catalog edit,
 * call invalidateCatalogIndex(catalog) before the next actor/sheet preparation.
 */
let racialIndexes = new WeakMap();
let itemIndexes = new WeakMap();
const EMPTY_RACIAL = Object.freeze({});
const EMPTY_ITEMS = Object.freeze([]);

export function invalidateCatalogIndex(catalog) {
  if (catalog) {
    racialIndexes.delete(catalog);
    itemIndexes.delete(catalog);
  } else {
    racialIndexes = new WeakMap();
    itemIndexes = new WeakMap();
  }
}

export function getCatalogById(catalog = EMPTY_ITEMS) {
  catalog ||= EMPTY_ITEMS;
  let index = itemIndexes.get(catalog);
  if (!index) {
    index = new Map();
    // Preserve Array.find semantics: first duplicate wins.
    for (const entry of catalog) if (!index.has(entry.id)) index.set(entry.id, entry);
    itemIndexes.set(catalog, index);
  }
  return index;
}

export function getRacialCatalogIndex(catalog = EMPTY_RACIAL) {
  catalog ||= EMPTY_RACIAL;
  let index = racialIndexes.get(catalog);
  if (index) return index;
  const byId = new Map(), toggleTraits = new Map(), stressById = new Map();
  for (const [race, traits] of Object.entries(catalog)) {
    for (const trait of traits) {
      const first = !byId.has(trait.id);
      if (first) byId.set(trait.id, { ...trait, race });
      const key = trait.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      let stress = 0;
      for (const effect of trait.effects || []) {
        const type = effect.activationType || 'passive';
        if (['passive', 'option', 'multi-option', 'choice'].includes(type)) {
          const id = `racial_${trait.traitCategory || 'secondary'}_${key}_${effect.level}`;
          if (!toggleTraits.has(id)) toggleTraits.set(id, new Set());
          toggleTraits.get(id).add(trait.id);
        }
        // Stress used to recognize only explicitly passive effects. Preserve it.
        if (effect.activationType !== 'passive') continue;
        const bonus = effect.automation?.stressBonus;
        if (Number.isFinite(bonus)) stress += bonus;
        else {
          // Legacy/custom catalog compatibility: parse once, never per actor.
          const text = (effect.text || '').toLowerCase();
          if (text.includes('increase your stress bonus by 1') || text.includes('increase stress bonus by 1')) stress++;
        }
      }
      if (first) stressById.set(trait.id, stress);
    }
  }
  index = { byId, toggleTraits, stressById };
  racialIndexes.set(catalog, index);
  return index;
}

export function getDisabledRacialPassives(catalog, enabledPassives = {}) {
  const { toggleTraits } = getRacialCatalogIndex(catalog);
  const disabled = new Set();
  for (const [effectId, enabled] of Object.entries(enabledPassives || {})) {
    if (enabled !== false) continue;
    for (const traitId of toggleTraits.get(effectId) || []) disabled.add(traitId);
  }
  return disabled;
}

export function getRacialStressBonus(catalog, selectedIds = []) {
  const { stressById } = getRacialCatalogIndex(catalog);
  let total = 0;
  for (const id of selectedIds || []) total += stressById.get(id) || 0;
  return total;
}
