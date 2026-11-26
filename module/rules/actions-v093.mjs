import { adversaryRound093 } from './adversaries-v093.mjs';
import { actionPools, canConvertAction } from './v093.mjs';
const num = value => Math.max(0, Number(value) || 0);
export function rowActionType093(row) {
  if (row?.effectiveType) return row.effectiveType;
  if (row?.type === 'defend' || row?.type === 'counter') return 'counter';
  if (['instant','out-of-sequence'].includes(row?.type)) return row.type;
  return 'standard';
}
export function rowCost093(row) {
  if (!row || row.dbuOutsideCombat || row.dbuExtraPowerStack || ['use','dodge'].includes(row.type)) return 0;
  if (['instant','out-of-sequence'].includes(rowActionType093(row))) return 0;
  return row.actionCost == null ? 1 : num(row.actionCost);
}
export function roundPools093(actor, { excludeIndex = -1, standardBonus = 0, counterBonus = 0 } = {}) {
  const rounds = actor.system?.combatTabState?.rounds || [];
  const round = rounds.at(-1) || {};
  const actions = round.actions || [];
  let standardSpent = 0, counterSpent = 0;
  actions.forEach((row, index) => {
    if (index === excludeIndex) return;
    if (rowActionType093(row) === 'counter') counterSpent += rowCost093(row);
    else standardSpent += rowCost093(row);
  });
  const conditions = actor.system?.conditions || [];
  const slowed = conditions.find(c => c.id === 'slowed' && c.active);
  const pinned = conditions.some(c => c.id === 'pinned' && c.active);
  const state = round.rules093 || {};
  // Native and integrated defenses share roundCounterCount. It is the SAME
  // payment represented by a defend row, so never add the two counters.
  counterSpent = Math.max(counterSpent, num(actor.system?.combatTabState?.roundCounterCount));
  const army = adversaryRound093(actor);
  const grant = army?.actions || 0;
  const pools = actionPools({ standardSpent, counterSpent, converted: state.converted, counterBase: grant ? 0 : 1,
    standardBonus: standardBonus + num(state.standardBonus), counterBonus: counterBonus + num(state.counterBonus),
    bonusMomentum: state.bonusMomentum, reducedMomentum: state.reducedMomentum, slowed: slowed?.stacks || 0, pinned });
  if (grant) {
    const instantSpent = actor.system.rules093State?.adversaryInstant?.key === army.key
      ? num(actor.system.rules093State.adversaryInstant.spent) : 0;
    pools.adversary = { granted: grant, remaining: Math.max(0, grant - counterSpent - instantSpent) };
    pools.counter.granted += grant;
    pools.counter.spent += instantSpent;
    pools.counter.remaining = Math.max(0, pools.counter.granted - pools.counter.spent);
  }
  return pools;
}
export async function convertStandardToCounter093(actor) {
  const cts = structuredClone(actor.system.combatTabState || {});
  if (!cts.rounds?.length) cts.rounds = [{ roundNumber: 1, actions: [] }];
  if (!canConvertAction(roundPools093(actor))) return { ok: false, reason: 'Sem Standard Action disponível ou limite de 6 Counter Actions atingido.' };
  const round = cts.rounds.at(-1); round.rules093 ??= {};
  round.rules093.converted = num(round.rules093.converted) + 1;
  await actor.update({ 'system.combatTabState': cts });
  return { ok: true };
}
export function isOwnTurn093(actor, combat = globalThis.game?.combat) {
  const current = combat?.combatant?.actor;
  return !!current && current.uuid === actor.uuid;
}
export function inCombat093(actor, combat = globalThis.game?.combat) {
  return !!combat && (combat.started || combat.round > 0) && !!combat.combatants?.find(c => c.actor?.uuid === actor.uuid);
}
