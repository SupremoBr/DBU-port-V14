import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerConfig } from '../module/helpers/config.mjs';
import { getCatalogById, getRacialCatalogIndex, invalidateCatalogIndex, getDisabledRacialPassives, getRacialStressBonus } from '../module/helpers/catalog-index.mjs';
import { ALL_RACIAL_TRAITS } from '../module/data/racial-traits-catalog.mjs';
import { ALL_TALENTS_DATA } from '../module/data/talents-catalog.mjs';
import { prepareCharacterTraits, prepareCharacterTalents, prepareCombatResources, prepareActiveEffects } from '../module/sheets/character-data.mjs';

// Original algorithms are independent oracles for catalog behavior.
function legacyDisabled(catalog, enabled) {
  const disabled = new Set();
  for (const traits of Object.values(catalog)) for (const trait of traits) {
    const key = trait.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    for (const e of trait.effects || []) {
      if (!['passive', 'option', 'multi-option', 'choice'].includes(e.activationType || 'passive')) continue;
      if (enabled[`racial_${trait.traitCategory || 'secondary'}_${key}_${e.level}`] === false) {
        disabled.add(trait.id);
        break;
      }
    }
  }
  return disabled;
}
function legacyStress(catalog, ids) {
  const all = Object.values(catalog).flat();
  let bonus = 0;
  for (const id of ids) for (const e of all.find(t => t.id === id)?.effects || []) {
    const text = (e.text || '').toLowerCase();
    if (e.activationType === 'passive' && (text.includes('increase your stress bonus by 1') || text.includes('increase stress bonus by 1'))) bonus++;
  }
  return bonus;
}

test('all racial and talent IDs preserve first-match lookup and race grouping', () => {
  const index = getRacialCatalogIndex(ALL_RACIAL_TRAITS);
  const all = Object.entries(ALL_RACIAL_TRAITS).flatMap(([race, list]) => list.map(t => ({ ...t, race })));
  for (const t of all) assert.deepEqual(index.byId.get(t.id), all.find(x => x.id === t.id));
  for (const t of ALL_TALENTS_DATA) assert.equal(getCatalogById(ALL_TALENTS_DATA).get(t.id), ALL_TALENTS_DATA.find(x => x.id === t.id));
});

test('duplicate IDs keep first entry and missing IDs stay undefined', () => {
  const a = { id: 'a', name: 'First', effects: [] }, b = { ...a, name: 'Second' };
  assert.equal(getCatalogById([a, b]).get('a'), a);
  const index = getRacialCatalogIndex({ first: [a], second: [b] });
  assert.equal(index.byId.get('a').name, 'First');
  assert.equal(index.byId.get('a').race, 'first');
  assert.equal(index.byId.get('absent'), undefined);
});

test('absent optional catalogs, toggles and selections are harmless', () => {
  assert.equal(getCatalogById(null).size, 0);
  assert.equal(getRacialCatalogIndex(null).byId.size, 0);
  assert.equal(getDisabledRacialPassives(null, null).size, 0);
  assert.equal(getRacialStressBonus(null, null), 0);
});

test('catalog identity reuses indexes; replacement and explicit invalidation rebuild', () => {
  const catalog = { race: [{ id: 'a', name: 'First', effects: [] }] };
  const original = getRacialCatalogIndex(catalog);
  assert.equal(getRacialCatalogIndex(catalog), original);
  assert.notEqual(getRacialCatalogIndex({ ...catalog }), original);
  catalog.race.push({ id: 'b', name: 'Second', effects: [] });
  invalidateCatalogIndex(catalog);
  const updated = getRacialCatalogIndex(catalog);
  assert.notEqual(updated, original);
  assert.ok(updated.byId.has('b'));
  const items = [{ id: 'a' }], oldItems = getCatalogById(items);
  items.push({ id: 'b' });
  invalidateCatalogIndex(items);
  assert.notEqual(getCatalogById(items), oldItems);
  assert.ok(getCatalogById(items).has('b'));
  invalidateCatalogIndex();
  assert.notEqual(getRacialCatalogIndex(catalog), updated);
});

test('disabled passives match old algorithm for every real catalog toggle', () => {
  const { toggleTraits } = getRacialCatalogIndex(ALL_RACIAL_TRAITS);
  for (const key of toggleTraits.keys()) {
    const enabled = { [key]: false, unknown: false };
    assert.deepEqual(getDisabledRacialPassives(ALL_RACIAL_TRAITS, enabled), legacyDisabled(ALL_RACIAL_TRAITS, enabled));
  }
  for (const value of [true, 0, null, undefined]) {
    const enabled = Object.fromEntries([...toggleTraits.keys()].map(k => [k, value]));
    assert.equal(getDisabledRacialPassives(ALL_RACIAL_TRAITS, enabled).size, 0);
  }
});

test('toggle collisions and missing activation/category preserve old behavior', () => {
  const c = { race: [
    { id: 'a', name: 'Shared Name', effects: [{ level: 1 }] },
    { id: 'b', name: 'Shared Name', effects: [{ level: 1, activationType: 'choice' }] },
    { id: 'c', name: 'Shared Name', effects: [{ level: 1, activationType: 'triggered' }] }
  ] };
  const enabled = { racial_secondary_shared_name_1: false };
  assert.deepEqual(getDisabledRacialPassives(c, enabled), legacyDisabled(c, enabled));
  assert.deepEqual([...getDisabledRacialPassives(c, enabled)], ['a', 'b']);
});

test('Stress matches original for all real traits, missing IDs and duplicate selections', () => {
  const ids = Object.values(ALL_RACIAL_TRAITS).flat().map(t => t.id);
  for (const selected of [[], ids, [...ids, ...ids, 'missing']]) {
    assert.equal(getRacialStressBonus(ALL_RACIAL_TRAITS, selected), legacyStress(ALL_RACIAL_TRAITS, selected));
  }
});

test('structured Stress takes precedence; legacy text is interpreted only on index creation', () => {
  let reads = 0;
  const c = { race: [{ id: 'a', name: 'Stress', effects: [
    { activationType: 'passive', automation: { stressBonus: 2 }, text: 'localized description' },
    { activationType: 'passive', automation: { stressBonus: 0 }, text: 'Increase your stress bonus by 1' },
    { activationType: 'passive', get text() { reads++; return 'INCREASE STRESS BONUS BY 1'; } },
    { activationType: 'option', automation: { stressBonus: 90 } },
    { text: 'Increase your stress bonus by 1' }
  ] }] };
  assert.equal(getRacialStressBonus(c, ['a', 'a', 'unknown']), 6);
  for (let i = 0; i < 10; i++) assert.equal(getRacialStressBonus(c, ['a']), 3);
  assert.equal(reads, 1);
});

test('sheet preparation keeps player-specific clones and fresh values across renders', () => {
  globalThis.CONFIG = { DBU: { racialTraitsCatalog: ALL_RACIAL_TRAITS, talentsCatalog: ALL_TALENTS_DATA } };
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  globalThis.game = { actors: new Map() };
  const snapshot = JSON.stringify([ALL_RACIAL_TRAITS, ALL_TALENTS_DATA]);
  const ids = Object.values(ALL_RACIAL_TRAITS).flat().map(t => t.id);
  const system = { racialTraits: [...ids, 'missing'], talents: ALL_TALENTS_DATA.map(t => t.id) };
  const first = prepareCharacterTraits(system), next = prepareCharacterTraits(system);
  assert.equal(first.length, ids.length);
  assert.deepEqual(first, next);
  assert.notEqual(first[0], next[0]);
  first[0].name = 'Player edit';
  assert.notEqual(prepareCharacterTraits(system)[0].name, 'Player edit');
  const talents = prepareCharacterTalents(system);
  assert.equal(talents.length, ALL_TALENTS_DATA.length);
  talents[0].name = 'Player talent edit';
  assert.notEqual(prepareCharacterTalents(system)[0].name, 'Player talent edit');
  const oldResources = prepareCombatResources({ ...system, aptitudes: { equipmentCombatPenalty: 2 } });
  assert.ok(oldResources.length > 0);
  const context = {};
  prepareActiveEffects(context, system);
  assert.ok(Object.keys(context).length > 0);
  assert.equal(JSON.stringify([ALL_RACIAL_TRAITS, ALL_TALENTS_DATA]), snapshot);
  assert.deepEqual(prepareCharacterTraits({ racialTraits: [] }), []);
  assert.deepEqual(prepareCharacterTalents({ talents: [] }), []);
});

test('64 complete view-data outputs retain the baseline signatures for every race and talent', () => {
  globalThis.CONFIG = {};
  registerConfig();
  Object.assign(CONFIG.DBU, { racialTraitsCatalog: ALL_RACIAL_TRAITS, talentsCatalog: ALL_TALENTS_DATA });
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  globalThis.game = { actors: new Map() };
  const racial = ALL_RACIAL_TRAITS, talents = ALL_TALENTS_DATA;
  const systems = [
    {},
    ...Object.values(racial).map(traits => ({ racialTraits: traits.map(t => t.id), talents: talents.map(t => t.id), tier: 3, baseTier: 2 })),
    { racialTraits: Object.values(racial).flat().map(t => t.id), talents: talents.map(t => t.id), adversary: { enabled: true }, effectTracking: { enabledPassives: {}, usedEffects: { round: {}, encounter: {} } } }
  ];
  const baseline = JSON.parse(readFileSync(new URL('./fixtures/view-data-baseline.json', import.meta.url))).hashes;
  const mapping = { _getCharacterTraits: prepareCharacterTraits, _getCharacterTalents: prepareCharacterTalents, _getCombatResources: prepareCombatResources, _prepareActiveEffects: prepareActiveEffects };
  for (const [name, fn] of Object.entries(mapping)) {
    systems.forEach((system, i) => {
      let output;
      if (name === '_prepareActiveEffects') { output = {}; fn(output, structuredClone(system)); }
      else output = fn(structuredClone(system));
      const actual = createHash('sha256').update(JSON.stringify(output)).digest('hex');
      assert.equal(actual, baseline[name][i], `${name}, scenario ${i}`);
    });
  }
});
