import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeGmPanelAutomation } from '../module/automation/scripts/gm-panel.js';

test('ending an active combat resets every participant and recovers player characters once', async () => {
  const hooks = new Map();
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback) };
  const gm = { id: 'gm', isGM: true, active: true };
  globalThis.game = { user: gm, users: [gm] };
  globalThis.ui = { notifications: { warn: assert.fail } };
  const cards = [];
  globalThis.ChatMessage = { create: async data => cards.push(data) };
  const makeActor = hasPlayerOwner => {
    const flags = {};
    return {
      id: 'actor', uuid: hasPlayerOwner ? 'Actor.actor' : 'Scene.s.Token.n.Actor.actor',
      type: 'character', hasPlayerOwner, name: 'Participant',
      system: { lifePoints: { max: 91, value: 88 }, kiPool: { max: 50, value: 30 },
        combatTabState: { currentRound: 3, rounds: [{ roundNumber: 3 }], roundCounterCount: 2 } },
      getFlag: (scope, key) => flags[scope]?.[key],
      async update(updates) {
        for (const [path, value] of Object.entries(updates)) {
          const parts = path.split('.');
          let current = path.startsWith('flags.') ? flags : this.system;
          for (const key of parts.slice(1, -1)) current = current[key] ??= {};
          current[parts.at(-1)] = value;
        }
      }
    };
  };
  const pc = makeActor(true);
  const npc = makeActor(false);
  const combat = { id: 'combat', round: 3, combatants: [{ actor: pc }, { actor: npc }, { actor: pc }] };
  initializeGmPanelAutomation();
  await Promise.all([hooks.get('deleteCombat')(combat), hooks.get('deleteCombat')(combat)]);
  assert.equal(pc.system.lifePoints.value, 91);
  assert.equal(pc.system.kiPool.value, 35);
  assert.equal(npc.system.kiPool.value, 30);
  for (const actor of [pc, npc]) {
    assert.equal(actor.system.combatTabState.currentRound, 0);
    assert.deepEqual(actor.system.combatTabState.rounds, []);
    assert.equal(actor.system.combatTabState.roundCounterCount, 0);
  }
  assert.equal(cards.length, 1);
  combat.previous = { round: 2 };
  combat.round = 0;
  await hooks.get('updateCombat')(combat, { round: 0 });
  await hooks.get('deleteCombat')(combat);
  assert.equal(pc.system.kiPool.value, 40);
  assert.equal(cards.length, 2);
});
