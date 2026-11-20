import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { installCharacterMethods } from '../module/sheets/character/install-methods.mjs';
import { listenersMethods } from '../module/sheets/character/listeners.mjs';
import { CATALOGS_093 } from '../module/rules/catalogs-v093.mjs';

// Exercise the actual exported sheet against a small Foundry lifecycle stub.
class ActorSheetStub {
  constructor(actor = { system: {} }) { this.actor = actor; this.isEditable = true; }
  activateListeners(html) { this.baseListenerCalls = (this.baseListenerCalls || 0) + 1; this.baseHtml = html; }
  async _updateObject(event, formData) { this.baseUpdateCalls = (this.baseUpdateCalls || 0) + 1; return { event, formData }; }
}
globalThis.ActorSheet = ActorSheetStub;
globalThis.foundry = { utils: { deepClone: structuredClone } };
globalThis.CONFIG = { DBU: {} };
const { DBUCharacterSheet } = await import('../module/sheets/character-sheet.mjs');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/character-methods-baseline.json', import.meta.url)));
const hash = fn => createHash('sha256').update(fn.toString()).digest('hex');

test('385 prototype methods retain their contract, with reviewed 0.9.3 rule changes', () => {
  assert.equal(Object.getPrototypeOf(DBUCharacterSheet.prototype), ActorSheetStub.prototype);
  const actual = Object.getOwnPropertyDescriptors(DBUCharacterSheet.prototype);
  assert.deepEqual(Object.keys(actual).filter(n => n !== 'constructor').sort(), Object.keys(baseline.methods).sort());
  for (const [name, expected] of Object.entries(baseline.methods)) {
    const d = actual[name];
    assert.equal(typeof d.value, 'function', name);
    assert.equal(d.enumerable, false, name);
    assert.equal(d.configurable, true, name);
    assert.equal(d.writable, true, name);
    assert.equal(d.value.length, expected.length, name);
    assert.equal(d.value.constructor.name === 'AsyncFunction', expected.async, name);
    // Original hashes are retained; intentional rule/UI changes have separate reviewed hashes.
    // Their 0.9.3 behavior is exercised in rules093-integration.test.mjs.
    if (name !== 'activateListeners') assert.equal(hash(d.value), expected.rules093Hash ?? expected.relocatedHash ?? expected.hash, name);
  }
});

test('default options and downtime tables retain the baseline implementation and values', () => {
  assert.equal(hash(Object.getOwnPropertyDescriptor(DBUCharacterSheet, 'defaultOptions').get), baseline.defaultOptionsHash);
  for (const [key, value] of Object.entries(baseline.downtime)) assert.deepEqual(DBUCharacterSheet[key], value);
  assert.equal(hash(listenersMethods.activateListeners), baseline.listenersHash);
});

test('editable sheet binds the same 246 events and preserves callback receivers', async () => {
  const updates = [], registrations = [];
  const sheet = new DBUCharacterSheet({ system: {}, update: async value => updates.push(value) });
  let populated = 0;
  sheet._populateTrackerSources = () => { populated++; };
  let edited;
  sheet._onItemEdit = function (event) { edited = { receiver: this, event }; };
  const html = { on: (...args) => registrations.push(args) };
  sheet.activateListeners(html);
  assert.equal(sheet.baseListenerCalls, 1);
  assert.equal(sheet.baseHtml, html);
  assert.equal(populated, 1);
  assert.deepEqual(registrations.map(args => args.slice(0, 2)), baseline.listenerBindings);
  const event = { currentTarget: { dataset: { skill: 'perception' }, value: '4' } };
  await registrations.find(([, selector]) => selector === '.skill-misc-input')[2](event);
  assert.deepEqual(updates, [{ 'system.skillMisc.perception': 4 }]);
  registrations.find(([, selector]) => selector === '.item-edit')[2](event);
  assert.equal(edited.receiver, sheet);
  assert.equal(edited.event, event);
});

test('read-only sheet calls the base lifecycle without installing edit handlers', () => {
  const sheet = new DBUCharacterSheet();
  sheet.isEditable = false;
  const registrations = [];
  sheet.activateListeners({ on: (...args) => registrations.push(args) });
  assert.equal(sheet.baseListenerCalls, 1);
  assert.equal(registrations.length, 0);
});

test('PL1 progression rejects a new talent category conflict while preserving saved selections', async () => {
  const [one, two] = CATALOGS_093.talents.filter(talent => talent.category === 'Attacking');
  const system = { rulesVersion: '0.9.3', progressionRows: [
    { level: 1, perkType: 'talent_addition', talent: one.name },
    { level: 1, perkType: 'talent_addition', talent: '' },
  ] };
  const sheet = new DBUCharacterSheet({ system });
  sheet.render = () => {};
  const warnings = [];
  const previousUI = globalThis.ui;
  globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
  try {
    await sheet._updateObject({}, { 'system.progressionRows.0.level': 1, 'system.progressionRows.1.talent': two.name });
    assert.equal(sheet.baseUpdateCalls, undefined);
    assert.match(warnings.pop(), /Attacking/);
    system.progressionRows[1].talent = two.name;
    await sheet._updateObject({}, { 'system.progressionRows.0.level': 1, 'system.progressionRows.1.level': 1 });
    assert.equal(sheet.baseUpdateCalls, 1);
  } finally {
    globalThis.ui = previousUI;
  }
});

test('0.9.3 racial choices bind to the sheet, persist by effect, and resolve linked choices', async () => {
  const catalog = CATALOGS_093.racialTraits;
  CONFIG.DBU.racialTraitsCatalog = catalog;
  const find = name => Object.values(catalog).flat().find(trait => trait.name === name);
  const divine = find('Divine Magic');
  const quick = find('Quick to Master');
  const eye = find('Eye of the Dragon');
  const refined = find('Refined Combat');
  const writes = [];
  const system = {
    race: 'shinjin', racialTraits: [divine.id, quick.id, eye.id, refined.id],
    racialOptionSelections: {},
  };
  const sheet = new DBUCharacterSheet({ system, update: async update => writes.push(update) });
  const registrations = [];
  sheet._populateTrackerSources = () => {};
  sheet.activateListeners({ on: (...args) => registrations.push(args) });
  const select = (trait, level, value, extra = {}) => registrations.find(([, selector]) => selector === '.option-select')[2]({
    currentTarget: { dataset: { traitId: trait.id, effectLevel: String(level), ...extra }, value },
  });
  const effect = (trait, level) => sheet._getCharacterTraits(system).find(entry => entry.id === trait.id).effects.find(e => e.level === level);
  const writeKey = (trait, path) => `system.racialOptionSelections.${trait.id}.${path}`;

  try {
    assert.equal(effect(divine, 3).hasSelection, false);
    await select(divine, 3, 'God of an Element');
    assert.deepEqual(writes.pop(), { [writeKey(divine, '3')]: 'God of an Element' });
    system.racialOptionSelections[divine.id] = { 3: 'God of an Element' };
    await select(divine, 3, 'Elemental (Metal)', { elementalProfile: 'true' });
    assert.deepEqual(writes.pop(), { [writeKey(divine, 'elementalProfiles.3')]: 'Elemental (Metal)' });
    system.racialOptionSelections[divine.id].elementalProfiles = { 3: 'Elemental (Metal)' };
    const domain = effect(divine, 3).options.find(option => option.selected);
    assert.equal(domain.elementalProfiles.find(profile => profile.selected).name, 'Elemental (Metal)');
    assert.ok(domain.elementalProfiles.some(profile => profile.name === 'Elemental (Plantlife)'));
    await select(divine, 3, 'God of Peace');
    assert.deepEqual(writes.pop(), { [writeKey(divine, '3')]: 'God of Peace', [writeKey(divine, 'elementalProfiles.-=3')]: null });

    assert.equal(effect(eye, 3).hasSelection, false);
    await select(quick, 3, 'Way of the Warrior');
    assert.deepEqual(writes.pop(), { [writeKey(quick, '3')]: 'Way of the Warrior' });
    system.racialOptionSelections[quick.id] = { 3: 'Way of the Warrior' };
    assert.equal(effect(eye, 3).options.find(option => option.selected).name, 'Way of the Warrior');
    await select(eye, 3, 'Way of the Serene');
    assert.equal(writes.length, 0);

    system.racialOptionSelections[refined.id] = { 3: ['Hand to Hand'] };
    const toggle = registrations.find(([, selector]) => selector === '.option-checkbox')[2];
    const checkbox = optionName => ({ dataset: { traitId: refined.id, effectLevel: '3', optionName }, checked: true });
    await toggle({ currentTarget: checkbox('Blaster') });
    assert.deepEqual(writes.pop(), { [writeKey(refined, '3')]: ['Hand to Hand', 'Blaster'] });
    system.racialOptionSelections[refined.id][3].push('Blaster');
    assert.equal(effect(refined, 3).selectedCount, 2);
    assert.equal(effect(refined, 3).options.find(option => option.name === 'Grappler').disabled, true);
    const third = checkbox('Grappler');
    await toggle({ currentTarget: third });
    assert.equal(third.checked, false);
    assert.equal(writes.length, 0);
  } finally {
    delete CONFIG.DBU.racialTraitsCatalog;
  }
});

test('form submission can call moved normalization and forwards to its base once', async () => {
  const original = [{ id: 1, name: 'Original', customField: 17 }];
  const sheet = new DBUCharacterSheet({ system: { transformations: structuredClone(original) } });
  const event = {}, formData = { 'system.transformations.0.name': 'Renamed' };
  const result = await sheet._updateObject(event, formData);
  assert.equal(sheet.baseUpdateCalls, 1);
  assert.equal(result.event, event);
  assert.equal(result.formData, formData);
  assert.equal(formData['system.transformations'][0].name, 'Renamed');
  assert.equal(formData['system.transformations'][0].customField, 17);
  assert.deepEqual(sheet.actor.system.transformations, original);
});

test('domain calls still honor subclass overrides and independent instance state', () => {
  class CustomSheet extends DBUCharacterSheet {
    _calcAuraTPCost(aura) { return aura.cost * this.factor; }
  }
  const a = new CustomSheet(), b = new CustomSheet();
  a.factor = 2; b.factor = 3;
  assert.equal(a._calcAurasTotalTP({ signatureAuras: [{ cost: 2 }, { cost: 3 }] }), 10);
  assert.equal(b._calcAurasTotalTP({ signatureAuras: [{ cost: 2 }, { cost: 3 }] }), 15);
});

test('tracker maneuvers resolve relocated dynamic imports and retain clash and Ki behavior', async () => {
  const flags = [], messages = [];
  const actor = {
    id: 'actor', name: 'Character',
    system: { tier: 1, baseTier: 1, attributes: { in: { score: 10 } }, skills: { intimidation: { rank: 2 }, bluff: { rank: 1 } }, kiPool: { value: 10 } },
    setFlag: async (...args) => flags.push(args),
    update: async changes => { if ('system.kiPool.value' in changes) actor.system.kiPool.value = changes['system.kiPool.value']; }
  };
  globalThis.foundry.utils.randomID = () => 'clash';
  globalThis.game = { users: [] };
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; this.total = 5; this.dice = [{ results: [{ result: 5 }] }]; }
    async evaluate() { return this; }
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async message => messages.push(message) };
  const sheet = new DBUCharacterSheet(actor);
  actor.sheet = sheet;
  const event = { preventDefault() {}, currentTarget: { dataset: { round: '1', actionIndex: '0' } } };
  await sheet._onUseTrackerTerrify(event);
  await sheet._onUseTrackerFeint(event);
  await sheet._onUseTrackerDirtyTrick(event);
  assert.deepEqual(flags.map(args => args[2].type), ['terrify', 'feint', 'dirtyTrick']);
  assert.deepEqual(flags.map(args => args[2].formula), ['1d10+9', '1d10+7', '1d10+7']);
  assert.equal(actor.system.kiPool.value, 8);
  assert.equal(messages.filter(message => message.flags?.['DBU-MRR-OLD']?.clash).length, 3);
});

test('downtime keeps the original lexical sheet class rather than subclass constants', async () => {
  class CustomSheet extends DBUCharacterSheet { static DT_COSTS = { reinforcingForm: 1 }; }
  const warnings = [];
  globalThis.ui = { notifications: { warn: text => warnings.push(text) } };
  const sheet = new CustomSheet({ system: { downtime: { currentPeriod: { active: true, totalDT: 1, spentDT: 0 } } } });
  await sheet._onDtUseActivity({ preventDefault() {}, currentTarget: { dataset: { activityId: 'reinforcingForm' } } });
  assert.deepEqual(warnings, ['Not enough DT remaining.']);
});

test('composition rejects conflicting or invalid methods before changing any prototype', () => {
  class Sheet { existing() {} }
  assert.throws(() => installCharacterMethods(Sheet, [
    { name: 'a', methods: { added() {} } }, { name: 'b', methods: { existing() {} } }
  ]), /duplicate method existing/);
  assert.equal(Object.hasOwn(Sheet.prototype, 'added'), false);
  assert.throws(() => installCharacterMethods(Sheet, [
    { name: 'a', methods: { added() {} } }, { name: 'b', methods: { added() {} } }
  ]), /duplicate method added/);
  assert.equal(Object.hasOwn(Sheet.prototype, 'added'), false);
  assert.throws(() => installCharacterMethods(Sheet, [{ name: 'invalid', methods: { value: 3 } }]), /not a method/);
});
