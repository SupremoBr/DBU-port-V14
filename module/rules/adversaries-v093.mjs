import { uses093 } from './v093.mjs';

export function isAdversary093(system) {
  return uses093(system) && !!system.adversary?.enabled && system.adversary.category !== 'mook';
}

export function adversaryBenefits093(system, level = system.level || 1, baseTier = system.baseTier || 1) {
  const adversary = system.adversary;
  if (!uses093(system) || !adversary?.enabled) return null;

  const pcc = Math.max(1, Math.trunc(Number(adversary.partySize) || 1));
  const category = adversary.category === 'superior' ? 'elite' : adversary.category;
  const legacyMook = category === 'mook';
  const multiplier = category === 'villain' ? 2 : category === 'elite' ? 1 : 0;
  return {
    category,
    legacyMook,
    pcc,
    life: legacyMook ? 0 : level * (multiplier ? multiplier * pcc : 1),
    ki: legacyMook ? 0 : level * (multiplier ? 2 * multiplier * pcc : 1),
    attributePoints: multiplier * pcc * baseTier,
    traitSlots: multiplier,
    stamina: 6 * multiplier * pcc * baseTier,
    adversaryActions: multiplier ? pcc : 0,
    karma: category === 'villain' ? pcc : category === 'elite' ? Math.max(1, Math.floor(pcc / 2)) : 0
  };
}

export function adversaryRound093(actor, combat = globalThis.game?.combat) {
  const benefits = actor && adversaryBenefits093(actor.system);
  const active = benefits?.adversaryActions && combat?.round > 0 && combat.started !== false
    && combat.combatants?.find(c => c.actor === actor || (actor.uuid && c.actor?.uuid === actor.uuid));
  if (!active) return null;
  const key = `${combat.id}:${combat.round}`;
  const rules = actor.system.adversary.partyRules || {};
  const saved = actor.system.rules093State?.adversaryStamina;
  const staminaMax = rules.narrativeStamina ? benefits.stamina : 0;
  const spent = saved?.key === key ? Math.max(0, Number(saved.spent) || 0) : 0;
  return { key, staminaMax, spent, stamina: Math.max(0, staminaMax - spent),
    actions: rules.oneManArmy ? benefits.adversaryActions : 0 };
}

export function spendNarrativeStamina093(actor, limit, preference) {
  if (actor.system.adversary?.partyRules?.[preference] === false) return { amount: 0, update: {} };
  const pool = adversaryRound093(actor);
  const amount = Math.min(Math.max(0, Number(limit) || 0), pool?.stamina || 0);
  return { amount, update: amount ? { 'system.rules093State.adversaryStamina': { key: pool.key, spent: pool.spent + amount } } : {} };
}
