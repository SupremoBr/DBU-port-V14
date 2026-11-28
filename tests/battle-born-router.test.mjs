import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeBattleBornRouter, routeBattleBornRoundGrant } from '../module/automation/scripts/battle-born-router.js';
import { combatRoundsMethods } from '../module/sheets/character/combat-rounds.mjs';

test('Battle Born uses the encounter round when the character sheet is out of sync', async () => {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  globalThis.ChatMessage = { create() {}, getSpeaker: () => ({}) };
  const grants = [];
  const sheet = { actor: { system: {}, update: async () => {} },
    _getJusticeChargeContext: () => ({ transforms: [] }), _battleBornGrantStack: async source => grants.push(source) };
  await combatRoundsMethods._onCombatNewRound.call(sheet, { preventDefault() {}, dbuCombatRound: 2 });
  assert.deepEqual(grants, ['Even Round 2']);
});

test('the owner receives the allocation for their unlinked combat token', async () => {
  const callbacks = [];
  globalThis.Hooks = { on: (_hook, callback) => callbacks.push(callback) };
  const gm = { id: 'gm', isGM: true };
  const owner = { id: 'player', active: true };
  const users = [gm, owner];
  users.get = id => users.find(user => user.id === id);
  globalThis.game = { user: gm, users };
  const packets = [];
  globalThis.ChatMessage = { create: async data => packets.push(data) };
  const originalTimeout = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;
  const grants = [];
  const token = { documentName: 'Token', uuid: 'Scene.scene.Token.unlinked' };
  const actor = { id: 'base', name: 'Saiyan', token,
    testUserPermission: user => user === owner,
    sheet: { _battleBornGrantStack: async source => grants.push(source) } };
  token.actor = actor;
  globalThis.fromUuid = async uuid => uuid === token.uuid ? token : null;

  try {
    initializeBattleBornRouter();
    assert.equal(await routeBattleBornRoundGrant(actor, 'Even Round 2'), true);
    assert.equal(packets[0].flags['DBU-MRR-OLD'].combatRequest.packet.tokenUuid, token.uuid);
    game.user = owner;
    game.actors = { get: () => assert.fail('should resolve the token, not the base actor') };
    const request = { ...packets[0], getFlag: (scope, key) => packets[0].flags[scope]?.[key] };
    await callbacks[1](request, {}, gm.id);
    assert.deepEqual(grants, ['Even Round 2']);
  } finally {
    globalThis.setTimeout = originalTimeout;
  }
});
