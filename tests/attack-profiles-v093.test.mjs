import test from 'node:test';
import assert from 'node:assert/strict';
import { attackForCombinationTarget, rollCombination } from '../module/automation/scripts/combat/combination.js';
import { applyEquipmentQualityBonuses } from '../module/equipment-automation/qualities.mjs';
import { applyDimensionBladeWear093, attackWeapon093, duelistParryBonus093, weaponRollModifiers093 } from '../module/helpers/weapon-state.mjs';
import { pinpointInsight093 } from '../module/rules/profiles-v093.mjs';

globalThis.Actor = class {};
const { DBUActor } = await import('../module/documents/actor.mjs');

function useDice(t, entries) {
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() {
      const [formula, total, natural] = entries.shift() || [];
      assert.equal(this.formula, formula);
      this.total = total;
      this.dice = [{ faces: 10, results: [{ result: natural }] }];
      return this;
    }
    toJSON() { return { formula: this.formula, total: this.total }; }
  };
  t.after(() => {
    delete globalThis.Roll;
    assert.equal(entries.length, 0);
  });
}

const attack = {
  strikeTotal: 17, attackerTier: 2, strikeCT: 10, strikeBotchThreshold: 1,
  woundCT: 10, woundBotchThreshold: 1,
  combination: { strikeFormula: '1d10+8', woundFormula: '1d10+12', critFormula: '1d8', botchPenalty: 4 }
};

test('Combination reuses each failed Dodge/Parry score and rolls Wound after the additional Strikes', async t => {
  useDice(t, [
    ['1d10+8', 14, 6], ['1d10+8', 16, 8], ['1d10+8', 18, 10], ['1d8', 2],
    ['1d10+8', 13, 5], ['1d10+8', 15, 7], ['1d10+8', 16, 8], ['1d10+12', 20, 8]
  ]);
  const { attackData, revealData } = await rollCombination(attack, [
    { key: 'parried', rules093: true, outcome: { defenseType: 'parry', total: 17 } },
    { key: 'dodgedLate', rules093: true, outcome: { defenseType: 'dodge', total: 14 } },
    { key: 'parriedLate', rules093: true, outcome: { defenseType: 'parry', total: 16 } }
  ]);
  assert.equal(attackData.combinationTargets.parried, undefined);
  assert.deepEqual(attackData.combinationTargets.dodgedLate, { totals: [14, 16, 20], defenseScore: 14, bonus: 8 });
  assert.equal(attackData.combinationTargets.parriedLate.bonus, 0);
  assert.equal(attackData.baseWoundTotal, 20);
  const revealed = { ...attackData, woundTotal: 23 }; // 3 points from United Attack
  assert.equal(attackForCombinationTarget(revealed, 'dodgedLate').woundTotal, 31);
  assert.equal(attackForCombinationTarget(revealed, 'parriedLate').woundTotal, 23);
  assert.equal(revealed.woundTotal, 23);
  assert.equal(revealData.combinationRollData.length, 7);
});

test('Combination skips the additional Strikes and Wound on a miss', async t => {
  useDice(t, []);
  const missed = await rollCombination(attack, [{ key: 'a', rules093: true, outcome: { defenseType: 'dodge', total: 18 } }]);
  assert.equal(missed.attackData.combinationMissed, true);
});

test('Combination compares extra Strikes against zero when the target forgoes Dodge', async t => {
  useDice(t, [
    ['1d10+3', 8, 5], ['1d10+3', 11, 8], ['1d10+3', 12, 9],
    ['1d10+3', 8, 5], ['1d10+3', 4, 1], ['1d10+3', 11, 8],
    ['1d10+3', 8, 5], ['1d10+3', 11, 8], ['1d10+3', 12, 9],
    ['1d10+12', 20, 8]
  ]);
  const { attackData } = await rollCombination({
    ...attack, combination: { ...attack.combination, strikeFormula: '1d10+3' }
  }, [
    { key: 'guard', rules093: true, outcome: { defenseType: 'guard' } },
    { key: 'direct', rules093: true, outcome: { defenseType: 'directHit' } },
    { key: 'flare', rules093: true, outcome: { defenseType: 'powerFlare', total: 29 } }
  ]);
  const resolved = { ...attackData, woundTotal: attackData.baseWoundTotal };
  assert.equal(attackData.combinationTargets.guard.defenseScore, 0);
  assert.equal(attackForCombinationTarget(resolved, 'guard').woundTotal, 32);
  assert.equal(attackForCombinationTarget(resolved, 'direct').woundTotal, 28);
  assert.equal(attackForCombinationTarget(resolved, 'flare').woundTotal, 32);
});

test('Combination honors additional ranks, linked rolls and a critical bonus on the deferred Wound', async t => {
  useDice(t, [
    ['1d10+8', 13, 5], ['1d10+8', 15, 7], ['1d10+8', 16, 8], ['1d10+8', 17, 9],
    ['1d10+12', 18, 6], ['1d10+12', 22, 10], ['1d8', 4], ['1d4', 2]
  ]);
  const { attackData } = await rollCombination({
    ...attack, combination: { ...attack.combination, extraChecks: 1, woundLinkMode: 'high', woundExtra: '1d4' }
  }, [{ key: 'a', rules093: true, outcome: { defenseType: 'dodge', total: 14 } }]);
  assert.equal(attackData.combinationTargets.a.bonus, 12);
  assert.equal(attackData.baseWoundTotal, 28);
  assert.equal(attackData.woundCritical, true);
});

test('Concentrated ignores half of total DR, including Guard and manual DR, for this attack only', () => {
  const actor = Object.create(DBUActor.prototype);
  const system = {
    status: { soak: 10, damageReduction: 5 },
    damageCalc: { woundRoll: 40, category: 'lethal', defense: 'guard', damageReduction: 2 }
  };
  const incoming = actor._calculateDamageCalc(system, 1, 1, { profile: 'Concentrated', profileRules093: true });
  assert.equal(incoming.effectiveSoak, 5);
  assert.equal(incoming.totalReduction, 9);
  assert.equal(incoming.healthReduction, 11);
  assert.equal(system.damageCalc.totalReduction, undefined);
  assert.equal(actor._calculateDamageCalc(system, 1, 1).healthReduction, 8);
});

test('Pinpoint doubles the modified Insight on critical and ignores Soak without changing the defender', () => {
  const insight = { attributes: { in: { score: 3, modifier: 2, totalScore: 5 } } };
  assert.equal(pinpointInsight093(insight, false), 5);
  assert.equal(pinpointInsight093(insight, true), 10);
  const actor = Object.create(DBUActor.prototype);
  const system = {
    status: { soak: 8, damageReduction: 6 },
    damageCalc: { woundRoll: 30, category: 'standard', defense: 'directHit' }
  };
  const pinpoint = { profile: 'Pinpoint', profileRules093: true, pinpointInsight: pinpointInsight093(insight, true) };
  const damage = actor._calculateDamageCalc(system, 1, 1, pinpoint);
  assert.equal(damage.effectiveSoak, 2);
  assert.equal(damage.healthReduction, 22);
  const piercing = actor._calculateDamageCalc(system, 1, 1, { ...pinpoint, armorPiercing: true });
  assert.equal(piercing.healthReduction, 27);
  assert.equal(system.status.soak, 8);
  assert.equal(actor._calculateDamageCalc(system, 1, 1).healthReduction, 12);
});

test('Targeting System uses the occupied slots of each equipped, intact weapon and expires when removed', () => {
  const makeWeapon = (id, slotsUsed) => ({ id, type: 'equipment', system: {
    equipmentType: 'weapon', worn: true, qualities: [{ qualityKey: 'targeting_system', slotsUsed }]
  } });
  const primary = makeWeapon('primary', 1);
  const secondary = makeWeapon('secondary', 2);
  const actor = { items: [primary, secondary], system: { rulesVersion: '0.9.3', level: 1, equipmentFlags: {} } };
  applyEquipmentQualityBonuses(actor, actor.system, 1, 1);
  assert.deepEqual(actor.system.equipmentFlags.weaponTargetingSystem, { primary: 1, secondary: 2 });

  secondary.system.qualities = [];
  applyEquipmentQualityBonuses(actor, actor.system, 1, 1);
  assert.deepEqual(actor.system.equipmentFlags.weaponTargetingSystem, { primary: 1 });

  primary.system.weaponLPDamage = 100;
  secondary.system.worn = false;
  secondary.system.qualities = makeWeapon('secondary', 2).system.qualities;
  applyEquipmentQualityBonuses(actor, actor.system, 1, 1);
  assert.deepEqual(actor.system.equipmentFlags.weaponTargetingSystem, {});
});

test('armed Bludgeoning and Piercing bypass DR and pre-category Soak respectively', () => {
  const actor = Object.create(DBUActor.prototype);
  const system = {
    status: { soak: 9, damageReduction: 7 },
    damageCalc: { woundRoll: 30, category: 'direct', defense: 'none' }
  };
  const bludgeoning = actor._calculateDamageCalc(system, 1, 1, { weaponCategory: 'bludgeoning', profileRules093: true });
  assert.equal(bludgeoning.effectiveSoak, 4);
  assert.equal(bludgeoning.healthReduction, 22); // Soak 4 + DR (7 - floor(7/2))
  const piercing = actor._calculateDamageCalc(system, 1, 1, { weaponCategory: 'piercing', profileRules093: true });
  assert.equal(piercing.effectiveSoak, 3); // floor((9 - ceil(9/4)) / 2)
  assert.equal(piercing.healthReduction, 20);
  assert.equal(actor._calculateDamageCalc(system, 1, 1, { weaponCategory: 'bludgeoning' }).healthReduction, 19);
  assert.equal(actor._calculateDamageCalc(system, 1, 1).healthReduction, 19);
});

test('Giant Weapon uses wielder size and still applies the weapon size modifier', () => {
  const system = { tier: 2, baseSize: 'medium', status: { currentSize: 'large' } };
  const weapon = { system: { weaponSize: 'big', qualities: [{ qualityKey: 'giant_weapon' }] } };
  assert.deepEqual(weaponRollModifiers093(system, weapon, 'Simple'), { strike: -4, wound: 10 });
  system.status.currentSize = 'gigantic';
  assert.deepEqual(weaponRollModifiers093(system, weapon, 'Simple'), { strike: -2, wound: 10 });
  assert.deepEqual(weaponRollModifiers093(system, null, 'Simple'), { strike: 0, wound: 0 });
});

test('Duelist adds one Tier to Parry while an intact physical Duelist weapon is wielded', () => {
  const weapon = { type: 'equipment', system: { equipmentType: 'weapon', weaponType: 'physical', worn: true,
    qualities: [{ qualityKey: 'duelist' }] } };
  const actor = { system: { rulesVersion: '0.9.3', tier: 3 }, items: [weapon, structuredClone(weapon)] };
  assert.equal(duelistParryBonus093(actor), 3);
  actor.items[0].system.worn = false;
  actor.items[1].system.weaponLPDamage = 32;
  assert.equal(duelistParryBonus093(actor), 0);
});

test('Dimension Blade spends its weapon LP per attack, rounds down, and caps at breakage', async () => {
  const weapon = { id: 'blade', name: 'Blade', type: 'equipment',
    system: { equipmentType: 'weapon', worn: true, weaponType: 'physical', weaponLPDamage: 24,
      qualities: [{ qualityKey: 'dimension_blade' }] },
    async update(updates) { this.system.weaponLPDamage = updates['system.weaponLPDamage']; }
  };
  const actor = { system: { rulesVersion: '0.9.3', level: 1, kiPool: { value: 20 } }, items: [weapon] };
  await Promise.all([applyDimensionBladeWear093(actor, weapon.id), applyDimensionBladeWear093(actor, weapon.id)]);
  assert.equal(weapon.system.weaponLPDamage, 30);
  await applyDimensionBladeWear093(actor, weapon.id);
  assert.equal(weapon.system.weaponLPDamage, 32);
  assert.equal(actor.system.kiPool.value, 20);
  const source = { foundation: 'Physical', weaponEquipped: weapon.id };
  assert.match(attackWeapon093(actor, source).issue, /quebrada/);
  weapon.system.qualities.push({ qualityKey: 'unbreakable' });
  assert.match(attackWeapon093(actor, source).issue, /Unbreakable/);
});
