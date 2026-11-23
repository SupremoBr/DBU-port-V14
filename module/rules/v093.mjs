import { SIGNATURE_MODIFIERS_093 } from './data/signature-modifiers-v093.mjs';

/** Mechanical constants from the current DBU rules, not the Foundry version.
 * Sources: /signature/, /actions-maneuvers/, /transformation-rules/ on dbu-rpg.com.
 */
export const RULES_VERSION = '0.9.3';
export const RULE_SOURCES = Object.freeze({
  techniques: 'https://dbu-rpg.com/signature/',
  actions: 'https://dbu-rpg.com/actions-maneuvers/',
  transformations: 'https://dbu-rpg.com/transformation-rules/',
  races: 'https://dbu-rpg.com/racial-rules/',
  talents: 'https://dbu-rpg.com/talents/'
});
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const int = value => Math.max(0, Math.trunc(n(value)));
export function uses093(system) { return system?.rulesVersion === RULES_VERSION; }
export function isUltimateTechnique(type) { return /ultimate|dramatic[ _-]*finisher/i.test(String(type || '')); }

export function techniquePointCap(baseTier) {
  const tier = Math.max(1, int(baseTier));
  return tier === 1 ? 25 : tier === 2 ? 30 : tier === 3 ? 40 : 50;
}

export function modifierPointCost(definition, ranks = 1) {
  if (!definition) return null;
  const count = Math.trunc(Number(ranks));
  if (!Number.isInteger(count) || count < 1 || count > definition.maxRanks) return null;
  return Array.isArray(definition.tpPerRank)
    ? definition.tpPerRank.slice(0, count).reduce((a, b) => a + b, 0)
    : definition.tpPerRank * count;
}

export function paidAdvantageTP093(row) {
  const cost = n(row.tpCost);
  const freeRanks = Math.min(int(row.ranks ?? 1), int(row.freeRanks));
  if (!freeRanks) return cost;
  const paidRanks = int(row.ranks ?? 1) - freeRanks;
  if (!paidRanks) return 0;
  return modifierPointCost(SIGNATURE_MODIFIERS_093.Advantages[row.name], paidRanks) ?? cost;
}

/** Return the amount spent or, with credits excluded, the full value used for KP and caps. */
export function techniquePointCost(technique, { includeFreeTP = true } = {}) {
  const advantages = (technique.advantages || []).reduce((sum, row) =>
    sum + (includeFreeTP ? paidAdvantageTP093(row) : n(row.tpCost)), 0);
  const disadvantages = (technique.disadvantages || []).reduce((sum, row) => sum + n(row.tpCost), 0);
  const free = includeFreeTP ? Math.max(0, n(technique.freeTP)) : 0;
  const base = technique.profile === 'Simple' ? 4 : 8;
  const subtotal = Math.max(8, base + advantages + disadvantages);
  const surcharge = isUltimateTechnique(technique.type ?? technique.techType) ? 4 : 0;
  return Math.max(0, subtotal + surcharge - free);
}

/** Returned KP is in (T) units, matching the sheet's existing cost pipeline. */
export function techniqueBaseKiUnits(technique, profileUnits = 0) {
  return Math.max(0, n(profileUnits)) + Math.ceil(techniquePointCost(technique, { includeFreeTP: false }) / 5);
}

export function awakeningLimits(baseTier) {
  const tier = Math.max(1, Math.min(7, int(baseTier)));
  return { lesser: [2, 3, 4, 5, 6, 7, 7][tier - 1], greater: [1, 1, 2, 2, 3, 3, 4][tier - 1], super: 1 };
}

export function fullAwakeningRecovery(maxLife, maxKi) {
  return { life: Math.ceil(Math.max(0, n(maxLife)) / 4), ki: Math.ceil(Math.max(0, n(maxKi)) / 4) };
}

export function isFormForStacking(transformation) {
  const type = String(transformation.transformationType || transformation.category || '').toLowerCase();
  return type.includes('form') || type.includes('transcend') || !!transformation.transcended;
}

/** Awakenings are always active and do not occupy either temporary slot. */
export function validateTransformationStack(transformations) {
  let forms = 0, enhancements = 0;
  for (const trans of transformations || []) {
    if (!trans.active) continue;
    const type = String(trans.transformationType || trans.category || '').toLowerCase();
    if (type.includes('awakening') || type === 'manifested_power') continue;
    if (isFormForStacking(trans)) forms++;
    else if (type.includes('enhancement')) enhancements++;
  }
  return { ok: forms <= 1 && enhancements <= 1, forms, enhancements };
}

/** The highest requirement plus half of each other stacked requirement. */
export function stackedStressRequirement(requirements) {
  const values = (requirements || []).map(n).filter(value => value > 0).sort((a, b) => b - a);
  return values.length ? values[0] + values.slice(1).reduce((sum, value) => sum + Math.floor(value / 2), 0) : 0;
}

/** Round ledger inputs are explicit, including rule-granted extra actions. */
export function actionPools({ standardSpent = 0, counterSpent = 0, converted = 0, standardBonus = 0, counterBonus = 0, bonusMomentum = false, reducedMomentum = false, slowed = 0, pinned = false } = {}) {
  const conversion = Math.min(5, int(converted));
  const standard = Math.max(0, (pinned ? 1 : 3) + n(standardBonus) + Number(!!bonusMomentum) - Number(!!reducedMomentum) - int(slowed));
  const counter = Math.min(6, Math.max(0, 1 + conversion + n(counterBonus)));
  return {
    standard: { granted: standard, spent: int(standardSpent) + conversion, remaining: Math.max(0, standard - int(standardSpent) - conversion) },
    counter: { granted: counter, spent: int(counterSpent), remaining: Math.max(0, counter - int(counterSpent)) },
    converted: conversion
  };
}

export function canConvertAction(pools) { return pools.standard.remaining >= 1 && pools.counter.granted < 6; }

export function validateManeuverTiming({ type = 'standard', cost = 1, pools, isOwnTurn = false, isAttackTarget = false, lastVoluntaryType = null, triggerId = null, usedTriggers = [], respondingTo = null, timingOverride = false } = {}) {
  const requested = Math.max(0, n(cost));
  if (type === 'instant') {
    if (respondingTo && respondingTo !== 'standard' && !timingOverride) return { ok: false, reason: 'instant-response' };
    return lastVoluntaryType === 'instant' && !timingOverride ? { ok: false, reason: 'consecutive-instant' } : { ok: true, cost: 0 };
  }
  if (type === 'out-of-sequence') {
    if (!triggerId && !timingOverride) return { ok: false, reason: 'missing-trigger' };
    return triggerId && usedTriggers.includes(triggerId) ? { ok: false, reason: 'trigger-used' } : { ok: true, cost: 0 };
  }
  if (type === 'counter') {
    if (!isAttackTarget && !timingOverride) return { ok: false, reason: 'not-attack-target' };
    return pools.counter.remaining >= requested ? { ok: true, cost: requested } : { ok: false, reason: 'counter-actions' };
  }
  if (!isOwnTurn && !timingOverride) return { ok: false, reason: 'not-own-turn' };
  return pools.standard.remaining >= requested ? { ok: true, cost: requested } : { ok: false, reason: 'standard-actions' };
}
