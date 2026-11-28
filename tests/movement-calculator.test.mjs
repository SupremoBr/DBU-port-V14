import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMovement } from '../module/automation/scripts/standard-actions/movement.js';

test('Movement prices normal, boosted and rapid distances under the active rules', () => {
  const system = { rulesVersion: '0.9.3', tier: 2, status: { normalSpeed: 4, boostedSpeed: 8 } };
  assert.equal(calculateMovement(system, { squares: 4 }).cost, 0);
  assert.equal(calculateMovement(system, { squares: 5 }).cost, 6);
  assert.equal(calculateMovement(system, { squares: 8 }).cost, 6);
  assert.equal(calculateMovement(system, { squares: 4, rapid: true }).cost, 4);
  assert.equal(calculateMovement(system, { squares: 8, rapid: true, discount: 2 }).cost, 8);
  assert.equal(calculateMovement(system, { squares: 6, discount: 99 }).cost, 0);
  for (const squares of [0, '', 4.5, 9, 'Infinity']) {
    assert.equal(calculateMovement(system, { squares }).cost, null);
  }
  assert.equal(calculateMovement({ ...system, rulesVersion: '0.9.2' }, { squares: 8 }).cost, 12);
});
