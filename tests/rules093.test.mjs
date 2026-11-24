import { weaponLifeMax } from '../module/helpers/weapon-state.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { techniquePointCap, techniquePointCost, techniqueBaseKiUnits, awakeningLimits, fullAwakeningRecovery, validateTransformationStack, stackedStressRequirement, actionPools, canConvertAction, validateManeuverTiming } from '../module/rules/v093.mjs';
import { RACES_093, validateRacialAttributes } from '../module/rules/races-v093.mjs';
import { PROFILES_093, profileKiUnits, minimumAttackKiUnits, validFoundation } from '../module/rules/profiles-v093.mjs';
import { techniquesMethods } from '../module/sheets/character/techniques.mjs';
import { attackPowerShot093, attackReferenceKiCost093, validateTechnique093, signatureUseIssue093, techniqueKiCost093 } from '../module/rules/techniques-v093.mjs';

test('signature caps follow the official base-tier table', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(techniquePointCap), [25, 30, 40, 50, 50, 50, 50]);
});
test('Ultimate and Dramatic Finisher surcharge is four after the TP floor', () => {
  const cheap = { disadvantages: [{ tpCost: -30 }] };
  assert.equal(techniquePointCost(cheap), 8);
  assert.equal(techniquePointCost({ ...cheap, type: 'Ultimate Signature' }), 12);
  assert.equal(techniquePointCost({ ...cheap, type: 'Dramatic Finisher' }), 12);
  const tech = { type: 'ultimate', advantages: [{ tpCost: 20 }], freeTP: 5 };
  assert.equal(techniquePointCost(tech), 27);
  assert.equal(techniqueBaseKiUnits(tech, 4), 11); // Full TP=32, no free-TP reduction to KP.
  assert.equal(techniquePointCost({ profile: 'Simple', advantages: [{ tpCost: 10 }] }), 14);
  assert.equal(techniquePointCost({ profile: 'Simple' }), 8); // General minimum still applies.
});
test('the actual sheet selects the reviewed Ultimate cost only for migrated actors', () => {
  const migrated = { actor: { system: { rulesVersion: '0.9.3' } } };
  const old = { actor: { system: { rulesVersion: '0.9.2' } } };
  assert.equal(techniquesMethods._calcTechTPCost.call(migrated, { type: 'ultimate' }), 12);
  assert.equal(techniquesMethods._calcTechTPCost.call(old, { type: 'ultimate' }), 14);
});

test('TP credits and granted ranks affect the wallet only, with the full value used for Ki and caps', () => {
  const system = { rulesVersion: '0.9.3', baseTier: 1 };
  const beam = { foundation: 'Energy', profile: 'Beam', advantages: [
    { name: 'Accurate', ranks: 2, freeRanks: 1, tpCost: 8 }
  ], freeTP: 3 };
  assert.equal(techniquePointCost(beam), 8);
  assert.equal(techniquePointCost(beam, { includeFreeTP: false }), 16);
  assert.equal(techniquePointCost({ ...beam, freeTP: 100 }), 0);
  assert.equal(techniqueKiCost093(beam, { system }).finalKP, techniqueKiCost093({
    ...beam, freeTP: 0, advantages: [{ ...beam.advantages[0], freeRanks: 0 }]
  }, { system }).finalKP);
  const oversized = { ...beam, freeTP: 25, advantages: [
    { name: 'Accurate', ranks: 3, freeRanks: 3, tpCost: 15 },
    { name: 'Power Shot', ranks: 3, freeRanks: 3, tpCost: 18 }
  ] };
  assert.equal(techniquePointCost(oversized), 0);
  assert.ok(validateTechnique093(oversized, system).issues.some(issue => /25 TP/.test(issue)));
  assert.equal(attackPowerShot093({ powerShot: 2, grantedAdvantages: [{ name: 'Power Shot', ranks: 2 }] }), 2);
  assert.equal(attackReferenceKiCost093({ profile: 'Beam', grantedAdvantages: [
    { name: 'Efficiency', ranks: 1 }
  ] }, { ...system, tier: 3 }), 4);
});
test('racial creation facts include nineteen races, dual saves, new races and explicit attribute choices', () => {
  assert.equal(Object.keys(RACES_093).length, 19);
  assert.deepEqual(RACES_093.nekoMajin.saves, ['cognitive', 'morale']);
  assert.deepEqual(RACES_093.yardrat.saves, ['cognitive', 'impulsive']);
  assert.equal(RACES_093.angel.canBeMinion, false);
  assert.equal(RACES_093.shadowDragon.life, 7);
  assert.equal(validateRacialAttributes('saiyan', { fo: 2, te: 2, ag: 1 }).ok, true);
  assert.equal(validateRacialAttributes('earthling', { in: 2, ag: 2, pe: 1 }).ok, true);
  assert.equal(validateRacialAttributes('earthling', { in: 2, fo: 2, pe: 1 }).ok, false);
  assert.equal(validateRacialAttributes('bioAndroid', { in: 2, te: 2, pe: 1 }).ok, true);
  assert.equal(validateRacialAttributes('bioAndroid', { fo: 2, ma: 2, pe: 1 }).reason, 'forbidden-pair');
});
test('current profile costs, foundations and minimums replace removed legacy assumptions', () => {
  assert.equal(Object.keys(PROFILES_093).length, 26);
  assert.equal(profileKiUnits('Beam'), 8);
  assert.equal(profileKiUnits('Blitz'), 4);
  assert.equal(profileKiUnits('Mega Flare'), 4);
  assert.equal(profileKiUnits('Sphere'), null);
  assert.equal(minimumAttackKiUnits('Soaring'), 2.5);
  assert.equal(validFoundation('Combination', 'Magic'), true);
  assert.equal(validFoundation('Crushing', 'Energy'), false);
});
test('Awakening limits and Grand Awakening recovery use the official table and rounding', () => {
  assert.deepEqual(awakeningLimits(1), { lesser: 2, greater: 1, super: 1 });
  assert.deepEqual(awakeningLimits(6), { lesser: 7, greater: 3, super: 1 });
  assert.deepEqual(awakeningLimits(7), { lesser: 7, greater: 4, super: 1 });
  assert.deepEqual(fullAwakeningRecovery(101, 51), { life: 26, ki: 13 });
});
test('a transcended Enhancement occupies the Form slot but Awakenings occupy neither', () => {
  assert.equal(validateTransformationStack([{ active: true, transformationType: 'form_alternate' }, { active: true, transformationType: 'enhancement_standard' }, { active: true, transformationType: 'manifested_power' }]).ok, true);
  assert.equal(validateTransformationStack([{ active: true, transformationType: 'form_alternate' }, { active: true, transformationType: 'enhancement_standard', transcended: true }]).ok, false);
  assert.equal(validateTransformationStack([{ active: true, transformationType: 'enhancement_standard', transcended: true }, { active: true, transformationType: 'enhancement_special' }]).ok, true);
});
test('stacked Stress adds half the other requirement to the highest', () => {
  assert.equal(stackedStressRequirement([12, 6]), 15);
  assert.equal(stackedStressRequirement([12, 7, 3]), 16); // Each division rounds down.
  assert.equal(stackedStressRequirement([0, 6, 12]), 15);
  assert.equal(stackedStressRequirement([]), 0);
});
test('Standard-to-Counter conversion consumes a Standard Action and caps the Counter pool', () => {
  const initial = actionPools();
  assert.equal(initial.standard.remaining, 3); assert.equal(initial.counter.remaining, 1);
  const converted = actionPools({ standardSpent: 1, converted: 1, counterSpent: 1 });
  assert.equal(converted.standard.remaining, 1); assert.equal(converted.counter.remaining, 1);
  assert.equal(canConvertAction(converted), true);
  const cap = actionPools({ standardBonus: 5, converted: 5, counterBonus: 9 });
  assert.equal(cap.counter.granted, 6); assert.equal(canConvertAction(cap), false);
  const momentum = actionPools({ bonusMomentum: true, reducedMomentum: true });
  assert.equal(momentum.standard.granted, 3);
});
test('Counter actions, turn timing, Instant sequencing and one OoS per trigger are checked independently', () => {
  const pools = actionPools({ counterSpent: 1 });
  assert.equal(validateManeuverTiming({ type: 'counter', pools, isAttackTarget: true }).reason, 'counter-actions');
  assert.equal(validateManeuverTiming({ type: 'standard', pools }).reason, 'not-own-turn');
  assert.equal(validateManeuverTiming({ type: 'instant', pools, lastVoluntaryType: 'instant' }).reason, 'consecutive-instant');
  assert.equal(validateManeuverTiming({ type: 'out-of-sequence', pools, triggerId: 'attack-1', usedTriggers: ['attack-1'] }).reason, 'trigger-used');
  assert.equal(validateManeuverTiming({ type: 'counter', pools: actionPools(), isAttackTarget: true }).ok, true);
});

test('current signature TP overrides stale prices and linked rolls can differ', () => {
  const system = { baseTier: 6, rulesVersion: '0.9.3' };
  const beam = { foundation: 'Energy', profile: 'Beam',
    advantages: [{ name: 'Splitting', ranks: 2, tpCost: 4 }],
    disadvantages: [{ name: 'Backlash', ranks: 2, tpCost: -1 }] };
  assert.equal(techniquePointCost(beam), 13);
  assert.equal(validateTechnique093(beam, system).ok, true);
  const linked = { ...beam,
    advantages: [{ name: 'Twin-Linked', notes: 'Strike' }],
    disadvantages: [{ name: 'Dead-Link', notes: 'Wound' }] };
  assert.equal(validateTechnique093(linked, system).ok, true);
  linked.disadvantages[0].notes = 'Strike';
  assert.match(validateTechnique093(linked, system).issues.join(' '), /mesma rolagem/);
  linked.advantages = [{ name: 'Efficiency' }];
  linked.disadvantages = [{ name: 'Inefficiency' }];
  assert.match(validateTechnique093(linked, system).issues.join(' '), /incompatível/);
});

test('a saved Limit Break checkbox does not block a current technique or give it a Super Profile', () => {
  const beam = { foundation: 'Energy', profile: 'Beam', type: 'signature', isLimitBreak: true };
  assert.equal(validateTechnique093(beam).ok, true);
  assert.equal(techniquePointCost(beam), 8);
  assert.equal(validateTechnique093({ ...beam, type: 'Limit Break' }).ok, false);
  assert.match(validateTechnique093({ ...beam, type: 'dramatic_finisher' }).issues.join(' '), /exige um Super Profile/);
});

test('weapon durability scales with shield size and Durable slots in 0.9.3', () => {
  for (const qualityKey of ['durable_weapon', 'durable']) {
    const shield = { weaponCategory: 'shield', weaponSize: 'big', qualities: [{ qualityKey, slotsUsed: 2 }] };
    assert.equal(weaponLifeMax(2, shield), 44);
    assert.equal(weaponLifeMax(2, shield, true), 54);
  }
});

test('signature use checks Climax and the selected Weapon Assisted weapon', () => {
  const actor = { system: { level: 1, rulesVersion: '0.9.3', thresholds: { injured: { crossed: true } } }, items: [] };
  const technique = { foundation: 'Physical', profile: 'Simple',
    disadvantages: [{ name: 'Climax Attack', ranks: 2 }] };
  assert.equal(signatureUseIssue093(actor, technique), '');
  actor.system.thresholds.injured.crossed = false;
  assert.match(signatureUseIssue093(actor, technique), /injured/);
  assert.match(signatureUseIssue093(actor, { ...technique, isWeapon: true }), /Selecione a arma/);
  assert.match(validateTechnique093({ ...technique, isWeapon: true }).issues.join(' '), /Weapon Assisted/);
});
