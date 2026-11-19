import test from 'node:test';
import assert from 'node:assert/strict';
import { techniquePointCap, techniquePointCost, techniqueBaseKiUnits, awakeningLimits, fullAwakeningRecovery, validateTransformationStack, stackedStressRequirement, actionPools, canConvertAction, validateManeuverTiming } from '../module/rules/v093.mjs';
import { RACES_093, validateRacialAttributes } from '../module/rules/races-v093.mjs';
import { PROFILES_093, profileKiUnits, minimumAttackKiUnits, validFoundation } from '../module/rules/profiles-v093.mjs';
import { techniquesMethods } from '../module/sheets/character/techniques.mjs';

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
