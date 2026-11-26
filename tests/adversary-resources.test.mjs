import test from 'node:test';
import assert from 'node:assert/strict';
import { adversaryRound093, spendNarrativeStamina093 } from '../module/rules/adversaries-v093.mjs';
import { roundPools093 } from '../module/rules/actions-v093.mjs';
import { dbuCheckAffordability, dbuPayKiAndCapacity } from '../module/automation/scripts/core/resources.js';

function setup() {
  const actor = { uuid: 'Actor.elite', system: {
    rulesVersion: '0.9.3', baseTier: 2,
    adversary: { enabled: true, category: 'elite', partySize: 3, partyRules: { narrativeStamina: true, oneManArmy: true } },
    rules093State: {}, combatTabState: {}, kiPool: { value: 10 }, status: { maxCapacity: 6, capacitySpent: 0 }
  }, async update(changes) {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split('.');
      const field = keys.pop();
      keys.reduce((data, key) => data[key], this)[field] = value;
    }
  } };
  const combat = { id: 'encounter', started: true, round: 1, combatants: [{ actor }] };
  globalThis.game = { combat };
  return { actor, combat };
}

test('Stamina is a shared reserve for damage and Ki and refreshes each combat round', async () => {
  const { actor, combat } = setup();
  assert.equal(adversaryRound093(actor).stamina, 36);
  const defense = spendNarrativeStamina093(actor, 30, 'staminaForDamage');
  assert.equal(defense.amount, 30);
  await actor.update(defense.update);
  assert.equal(dbuCheckAffordability(actor, 11, 'Ataque', false).ok, true);
  assert.equal(dbuCheckAffordability(actor, 13, 'Ataque', false).reason, 'capacity');
  const paid = await dbuPayKiAndCapacity(actor, 11);
  assert.equal(paid.staminaSpent, 6);
  assert.equal(actor.system.kiPool.value, 5);
  assert.equal(actor.system.status.capacitySpent, 5);
  assert.equal(adversaryRound093(actor).stamina, 0);
  combat.round++;
  assert.equal(adversaryRound093(actor).stamina, 36);
  actor.system.adversary.partyRules.staminaForDamage = false;
  assert.equal(spendNarrativeStamina093(actor, 3, 'staminaForDamage').amount, 0);
  combat.started = false;
  assert.equal(adversaryRound093(actor), null);
});

test('One-Man Army replaces the base Counter and reserves two actions for an Instant', () => {
  const { actor, combat } = setup();
  assert.equal(roundPools093(actor).counter.granted, 3);
  actor.system.combatTabState.roundCounterCount = 1;
  assert.equal(roundPools093(actor).adversary.remaining, 2);
  actor.system.rules093State.adversaryInstant = { key: 'encounter:1', spent: 2 };
  assert.equal(roundPools093(actor).counter.remaining, 0);
  actor.system.adversary.partySize = 8;
  assert.equal(roundPools093(actor).counter.granted, 8);
  combat.combatants = [];
  assert.equal(roundPools093(actor).counter.granted, 1);
});
