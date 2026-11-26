import test from 'node:test';
import assert from 'node:assert/strict';
import { validateActionUse } from '../module/automation/scripts/action-economy.js';

test('empty action pools report costs without blocking granted maneuvers', () => {
  const actor = { uuid: 'Actor.fighter', system: { rulesVersion: '0.9.3', combatTabState: {
    rounds: [{ actions: [{ type: 'attack', actionCost: 3 }, { type: 'counter', actionCost: 1 }] }]
  } } };
  const combatant = { actor };
  globalThis.game = { combat: { started: true, round: 1, combatant, combatants: [combatant] } };
  let result = validateActionUse(actor, { notify: false });
  assert.equal(result.ok, true);
  assert.equal(result.overBudget, true);
  game.combat.combatant = { actor: { uuid: 'Actor.other' } };
  assert.equal(validateActionUse(actor, { notify: false }).ok, true);
  result = validateActionUse(actor, { effectiveType: 'counter', notify: false, isAttackTarget: true });
  assert.equal(result.ok, true);
  assert.equal(result.overBudget, true);
  assert.equal(validateActionUse(actor, { effectiveType: 'counter', notify: false }).ok, false);
  assert.equal(validateActionUse(actor, { effectiveType: 'out-of-sequence', notify: false }).ok, false);
  assert.equal(validateActionUse(actor, { effectiveType: 'out-of-sequence', triggerId: 'trait', notify: false }).ok, true);
});
