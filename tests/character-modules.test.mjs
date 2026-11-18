import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { installCharacterMethods } from '../module/sheets/character/install-methods.mjs';
import { listenersMethods } from '../module/sheets/character/listeners.mjs';

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

test('all 385 prototype methods retain names, signatures, descriptors and inheritance', () => {
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
    // Only this lifecycle wrapper changed: its original body moved to listeners.
    if (name !== 'activateListeners') assert.equal(hash(d.value), expected.relocatedHash ?? expected.hash, name);
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
