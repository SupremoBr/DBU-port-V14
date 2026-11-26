import test from 'node:test';
import assert from 'node:assert/strict';
import { assignDefaultCombatantTeam, assignDefaultCombatTeams, getCombatantTeam, setCombatantTeam, tokenRelation } from '../module/automation/scripts/combat-teams.js';

test('combat teams distinguish tokens of the same actor and preserve manual fallback', async () => {
  const gm = { id: 'gm', isGM: true };
  globalThis.game = { user: gm, users: Object.assign([gm], { activeGM: gm }) };
  const scene = { id: 'scene' };
  const actor = { id: 'base-actor', hasPlayerOwner: true };
  const example = (id, disposition) => {
    const flags = {};
    const token = { id, actor, parent: scene, disposition, documentName: 'Token' };
    const combatant = { id, token, actor, getFlag: (_, key) => flags[key], async setFlag(_, key, value) { flags[key] = value; } };
    return { token, combatant };
  };
  const one = example('one', 1), two = example('two', 1), three = example('three', -1);
  game.combat = { scene, combatants: [one.combatant, two.combatant, three.combatant] };
  await setCombatantTeam(one.combatant, 'team-a');
  await setCombatantTeam(two.combatant, 'team-b');
  await setCombatantTeam(three.combatant, 'team-a');
  assert.equal(tokenRelation(one.token, two.token), 'enemy');
  assert.equal(tokenRelation(one.token, three.token), 'ally');
  assert.equal(tokenRelation(one.token, one.token), 'self');
  await setCombatantTeam(two.combatant, '');
  assert.equal((await assignDefaultCombatTeams()).assigned, 0);
  await assignDefaultCombatantTeam(two.combatant);
  assert.equal(getCombatantTeam(two.combatant), '');
  assert.equal(tokenRelation(one.token, two.token), 'ally');
  assert.equal(tokenRelation(one.token, example('unknown', undefined).token), 'unknown');
});
