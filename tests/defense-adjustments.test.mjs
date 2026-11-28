import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefenseCore } from '../module/automation/scripts/combat/defense-core.js';
import { finishDefense } from '../module/automation/scripts/core/private-rolls.js';

test('defense dialog cancels before rolling and carries per-target adjustments through revelation', async () => {
  const { dbuResolveDefense } = createDefenseCore({ dbuPrepareSheet: async () => ({}) });
  const updates = [];
  const actor = { name: 'Player', system: {}, update: async data => updates.push(data) };
  const attack = { sealedRoll: true, damageCategory: 'Lethal' };
  const context = { deferReveal: true };
  globalThis.Dialog = { wait: async dialog => dialog.buttons.cancel.callback() };
  assert.deepEqual(await dbuResolveDefense(actor, attack, 'dodge', context), { cancelled: true });
  assert.deepEqual(updates, []);

  const fields = { bonus: '4', soak: '5', reduction: '3', category: 'direct' };
  globalThis.Dialog.wait = async (dialog, options) => {
    assert.match(dialog.content, /Do ataque \(Lethal\)/);
    assert.ok(options.classes.includes('dbua-system-dialog'));
    return dialog.buttons.apply.callback({ find: selector => ({ val: () => fields[selector.replace('#dbu-defense-', '')] }) });
  };
  globalThis.Roll = class {
    constructor(formula) {
      assert.equal(formula, '(1d10)+(4)');
      this.dice = [{ results: [{ result: 6 }] }];
      this.total = 10;
    }
    async evaluate() {}
    toJSON() { return {}; }
  };
  const result = await dbuResolveDefense(actor, attack, 'dodge', context);
  const outcome = finishDefense({ strikeTotal: 12, woundTotal: 15 }, result.hiddenOutcome, true);
  assert.equal(outcome.success, false);
  assert.equal(outcome.damageDefense, 'none');
  assert.deepEqual(outcome.incomingDamage, { soak: 5, reduction: 3, category: 'direct' });
  assert.equal(attack.damageCategory, 'Lethal');
});
