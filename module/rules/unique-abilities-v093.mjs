import { uses093 } from './v093.mjs';
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

function accessibleUniqueKeys093(actor, system) {
  const keys = new Set();
  if (!uses093(system)) return keys;
  const add = rows => {
    for (const row of rows || []) keys.add(row.abilityKey);
  };
  add(system.uniqueAbilities);
  const fusion = system.fusion;
  if (fusion?.isFusion && ["one-sided-absorption", "one-sided-possession"].includes(fusion.type)
      && !actor._blockGainedAbilities?.(system)) {
    for (const id of fusion.suppressedCharacterIds || []) add(globalThis.game?.actors?.get(id)?.system.uniqueAbilities);
  }
  const jacket = system.isPiloting && globalThis.game?.actors?.get(system.pilotedJacketId);
  if (jacket?.type === "battleJacket" && jacket.system.pilotId === actor.id) add(jacket.system.uniqueAbilities);
  return keys;
}

export function uniqueCombatPassives093(actor, system, tier) {
  const keys = accessibleUniqueKeys093(actor, system);
  return {
    boostedSpeed: keys.has("dragon_dash") ? tier : 0,
    initiative: keys.has("precognition") ? tier : 0
  };
}

const skillPassives = {
  bluff: { bonus: ["bluff_attack", "down_burst"], check: ["illusion"] },
  concealment: { bonus: ["down_burst"] },
  medicine: { check: ["healing_hands"] },
  performance: { check: ["metamoran_fusion_dance"], critical: ["para_para_dance"] }
};

export function uniqueSkillPassives093(actor, skill) {
  const effects = Object.hasOwn(skillPassives, skill) ? skillPassives[skill] : null;
  if (!effects) return { bonus: 0, check: 0, critical: 0 };
  const keys = accessibleUniqueKeys093(actor, actor.system);
  const count = group => (effects[group] || []).filter(ability => keys.has(ability)).length;
  return { bonus: count("bonus"), check: count("check"), critical: count("critical") };
}
