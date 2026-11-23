import { UNIQUE_ABILITIES_093, UNIQUE_ABILITIES_SOURCE_093 } from './data/unique-abilities-v093.mjs';

export function uniqueAbilityCatalog093(legacy = {}) {
  const oldOptions = (options, current = []) => (options || [])
    .filter(option => !current.some(entry => entry.id === option.id))
    .map(option => ({ ...option, legacy: true }));

  const catalog = Object.fromEntries(Object.entries(UNIQUE_ABILITIES_093).map(([id, data]) => [id, {
    ...data,
    source: id === 'fake_moon' ? UNIQUE_ABILITIES_SOURCE_093 + '#fake-moon' : UNIQUE_ABILITIES_SOURCE_093,
    advancements: [...data.advancements, ...oldOptions(legacy[id]?.advancements, data.advancements)],
    restrictions: [...data.restrictions, ...oldOptions(legacy[id]?.restrictions, data.restrictions)]
  }]));

  for (const [id, data] of Object.entries(legacy)) {
    if (Object.hasOwn(catalog, id)) continue;
    catalog[id] = {
      ...data,
      legacy: true,
      advancements: oldOptions(data.advancements),
      restrictions: oldOptions(data.restrictions)
    };
  }
  return catalog;
}

export function uniqueAbilityOptions(data, selectedRestrictions = []) {
  const locks = new Set();
  for (const { restrictionId } of selectedRestrictions) {
    const restriction = data.restrictions?.find(row => row.id === restrictionId && !row.legacy);
    for (const name of restriction?.lockedAdvancements || []) locks.add(name);
  }
  return {
    advancements: (data.advancements || []).filter(row => !row.legacy && !locks.has(row.name)),
    restrictions: (data.restrictions || []).filter(row => !row.legacy)
  };
}

export function minimumUniqueKi093(baseCost, tier) {
  return baseCost >= 4 * tier ? Math.ceil(baseCost / 2) : 0;
}

const encounterAbilities = new Set(['copy_being', 'fake_death', 'god_meteor', 'warped_evolution']);

export function uniqueAbilityUsage(data, selection) {
  if (data.source && encounterAbilities.has(data.id)) return { usageLimit: 'encounter', maxUses: 1 };
  const barrage = data.source && data.id === 'petrification'
    ? (selection.advancements || []).filter(row => row.advancementId === 'petrification_barrage')
      .reduce((ranks, row) => ranks + (row.amount || 1), 0)
    : 0;
  return { usageLimit: 'round', maxUses: 1 + Math.min(2, barrage) };
}
