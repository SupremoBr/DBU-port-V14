import { normalizeAreaConfig } from '../module/automation/scripts/area-attack.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { finishDefense, openRoll, sealRoll } from '../module/automation/scripts/core/private-rolls.js';
import { listenRequests } from '../module/automation/scripts/core/authorized-request.js';
import { changeJacketPilot } from '../module/sheets/jacket-pilot.mjs';
import { omitUnchangedFields, rebaseSheetRows } from '../module/sheets/sheet-edits.mjs';
import { urgentWoundFormulaFromAttack } from '../module/automation/scripts/intervene.js';
import { areaRegionData } from '../module/automation/scripts/area-preview.js';

test('a hidden attack keeps both rolls private and reveals United Attack damage once', async () => {
  const journal = { id: 'journal', pages: new Map(), getFlag: () => 'roller',
    async createEmbeddedDocuments(_, [page]) { this.pages.set(page._id, page); return [{ id: page._id }]; } };
  globalThis.game = { journal: new Map([[journal.id, journal]]) };
  const attack = await sealRoll(journal, 'card', { strikeTotal: 10, baseWoundTotal: 9, woundTotal: 9,
    strikeCritical: true }, { revealedHtml: '<b>10</b>' });
  assert.equal(attack.strikeTotal, undefined);
  assert.equal(attack.strikeCritical, undefined);
  assert.throws(() => openRoll(attack, { id: 'card', author: { id: 'other' } }));
  attack.unitedAttackBonus = 3;
  const { reveal } = openRoll(attack, { id: 'card', author: { id: 'roller' } });
  assert.equal(reveal.revealedHtml, '<b>10</b>');
  assert.equal(attack.woundTotal, 12);
  assert.equal(finishDefense(attack, { defenseType: 'dodge', total: 10 }, true).success, true);
  assert.equal(finishDefense(attack, { defenseType: 'crossCounter', total: 10 }, true).success, false);
  assert.equal(finishDefense(attack, { defenseType: 'powerFlare', total: 12 }, true).success, false);
  assert.equal(finishDefense(attack, { defenseType: 'powerFlare', total: 12 }, false).success, true);
  assert.equal(finishDefense(attack, { defenseType: 'guard' }, true).damageDefense, 'guard');
});

test('the recipient dispatches only addressed requests with the Foundry operation author', async () => {
  const sender = { id: 'player' };
  globalThis.game = { user: { id: 'gm', isGM: true }, users: new Map([[sender.id, sender]]) };
  let receive;
  globalThis.Hooks = { on(_event, fn) { receive = fn; } };
  const seen = [];
  listenRequests('standard', (_packet, user) => seen.push(user.id));
  const msg = { whisper: ['gm'], getFlag: () => ({ channel: 'standard', target: 'gm', packet: {} }), delete: async () => {} };
  await receive(msg, {}, 'unknown');
  await receive({ ...msg, whisper: [] }, {}, 'player');
  await receive(msg, {}, 'player');
  assert.deepEqual(seen, ['player']);
});

test('sheet editing keeps concurrent HP changes and merges reordered rows by identity', () => {
  const key = 'system.lifePoints.value';
  const sheet = { _renderedFields: { [key]: [20, 20], name: 'old' } };
  const submitted = { [key]: [20, 20], name: 'new' };
  omitUnchangedFields(sheet, submitted);
  assert.deepEqual(submitted, { name: 'new' });
  const rows = [{ id: 1, value: 2 }, { id: 2, value: 3 }];
  assert.deepEqual(rebaseSheetRows(rows, [...rows].reverse(), { 0: { value: 4 } }), { 1: { value: 4 } });
  assert.equal(rebaseSheetRows(rows, [{ id: 1, value: 5 }], { 0: { value: 4 } }), null);
});

test('the jacket and both displaced partners are submitted together after ownership checks', async () => {
  const actor = (id, type, system) => ({ id, type, system, isOwner: true });
  const j = actor('j', 'battleJacket', { pilotId: 'p0' }), p = actor('p', 'character', { pilotedJacketId: 'j0' });
  const j0 = actor('j0', 'battleJacket', { pilotId: 'p' }), p0 = actor('p0', 'character', { pilotedJacketId: 'j' });
  globalThis.game = { actors: new Map([j,p,j0,p0].map(doc => [doc.id, doc])) };
  const writes = [];
  globalThis.CONFIG = { Actor: { documentClass: { updateDocuments: async patches => writes.push(patches) } } };
  p0.isOwner = false;
  await assert.rejects(changeJacketPilot(j, p), /controlar/);
  assert.equal(writes.length, 0);
  p0.isOwner = true;
  await changeJacketPilot(j, p);
  assert.deepEqual(writes[0].map(row => row._id), ['p0','j0','j','p']);
  assert.equal(writes.length, 1);
});

test('V14 Regions preserve the direction, scene level and scaled area dimensions', () => {
  globalThis.canvas = { dimensions: { distancePixels: 20 }, level: { id: 'floor' } };
  globalThis.game = { user: { id: 'gm' } };
  globalThis.CONST = { REGION_VISIBILITY: { ALWAYS: 0 } };
  const data = { x: 30, y: 20, distance: 4, width: 2, angle: 90, direction: 135 };
  const region = t => areaRegionData({ ...data, t });
  assert.deepEqual(region('ray').levels, ['floor']);
  assert.deepEqual(region('ray').shapes[0], { type: 'line', x: 30, y: 20, length: 80, width: 40, rotation: 135 });
  assert.equal(region('circle').shapes[0].radius, 80);
  assert.equal(region('cone').shapes[0].rotation, 135);
});

test('Reflect preserves the original Wound formula with charges and wager exactly once', () => {
  globalThis.game = { messages: new Map() };
  const formula = '1d10+3d8+9';
  const source = { woundBaseFormula: formula, wager: 9, energyCharges: 3, manualWoundTranslated: '2d6', unitedAttackBonus: 4 };
  const urgent = urgentWoundFormulaFromAttack(source);
  assert.equal(urgent, '((1d10+3d8+9)+(2d6))+4');
  assert.equal(urgentWoundFormulaFromAttack({ urgentWoundFormula: urgent }), urgent);
  assert.equal(urgentWoundFormulaFromAttack({}, { getFlag: () => ({ woundRollData: { formula } }) }), formula);
  assert.equal(urgentWoundFormulaFromAttack({}), null);
});

test('Limited Line caps only current Line techniques by rank', () => {
  globalThis.CONFIG = { DBU: { rulesVersion: '0.9.3' } };
  const actor = { system: { rulesVersion: '0.9.3' } };
  const source = { profile: 'Wave', disadvantages: [{ name: 'Limited Line', ranks: 1 }] };
  assert.equal(normalizeAreaConfig({}, source, actor).lineLimit, 8);
  source.disadvantages[0].ranks = 2;
  assert.equal(normalizeAreaConfig({}, source, actor).lineLimit, 4);
  assert.equal(normalizeAreaConfig({ shape: 'circle' }, source, actor).lineLimit, null);
  assert.equal(normalizeAreaConfig({}, source, {}).lineLimit, null);
});
