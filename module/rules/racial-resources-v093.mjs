import { inCombat093, isOwnTurn093 } from './actions-v093.mjs';
import { racialEffectEnabled093 } from './runtime-v093.mjs';
import { uses093 } from './v093.mjs';
import { Dialog } from '../helpers/foundry-compat.mjs';

const resourcePath = 'system.rules093State.racialResources';
const maxResilienceSuccesses = 2;
const pending = new WeakSet();
const count = value => Math.max(0, Math.trunc(Number(value) || 0));
const has = (system, name, level = 1) => uses093(system) && racialEffectEnabled093(system, name, level);
const pressure = system => has(system, 'Demonic Pressure', 2);
const resilience = system => has(system, 'Demonic Resilience', 2);
const overwhelmEnabled = system => has(system, 'Overwhelming Fighter');

function resources(system) { return system.rules093State?.racialResources || {}; }
function resilienceSuccesses(state) {
  // Older actors recorded one active bonus as a boolean.
  return Math.min(maxResilienceSuccesses, count(state.resilienceSuccesses ?? state.resilienceActive));
}
function updateFields(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [`${resourcePath}.${key}`, value]));
}
function roundKey(actor, combat) {
  if (inCombat093(actor, combat)) return `${combat.id}:${combat.round}`;
  return `sheet:${actor.system.combatTabState?.currentRound || 1}`;
}

export function racialResourceBonuses093(system, tier) {
  const state = resources(system);
  const power = pressure(system) ? count(state.demonicPower) : 0;
  const fatigue = pressure(system) ? count(state.demonicFatigue) : 0;
  const overwhelm = overwhelmEnabled(system) ? Math.min(4, count(state.overwhelm)) : 0;
  const fatiguePenalty = has(system, 'Demonic Pressure', 5) ? fatigue * tier : 0;
  const phantom = has(system, 'Fallen Idol', 3);
  return {
    power, fatigue, overwhelm,
    demonicWound: has(system, 'Demonic Pressure', 4) ? 2 * power * tier : 0,
    defensePenalty: fatiguePenalty,
    soak: (phantom ? power * tier : 0) - fatiguePenalty,
    steadfast: phantom ? power : 0,
    might: power >= 2 && has(system, 'Demonic Pressure', 6) ? tier : 0,
    combatRolls: power >= 2 && has(system, 'Demons of the Makyo Star') ? tier : 0,
    dr: resilience(system) ? 2 * tier * resilienceSuccesses(state) : 0
  };
}

export function applyRacialResources093(system, tier, b = racialResourceBonuses093(system, tier)) {
  if (!uses093(system) || !['demon', 'arcosian'].includes(system.race)) return;
  const { aptitudes, status } = system;
  aptitudes.woundBuffTotal = (aptitudes.woundBuffTotal || 0) + b.demonicWound + b.combatRolls + b.overwhelm * tier;
  aptitudes.strikeBuffTotal = (aptitudes.strikeBuffTotal || 0) + b.combatRolls;
  aptitudes.dodgeBuffTotal = (aptitudes.dodgeBuffTotal || 0) + b.combatRolls;
  status.might = (status.might || 0) + b.might;
  status.mightForClashes = (status.mightForClashes || 0) + b.might;
  if (b.steadfast) aptitudes.steadfastBonus = (aptitudes.steadfastBonus || 0) + b.steadfast;
}

export function applyResilienceSave093(system, tier) {
  const lp = system.lifePoints;
  if (has(system, 'Demonic Resilience') && lp?.max > 0 && lp.value <= Math.floor(lp.max / 4) && system.savingThrows?.cognitive) {
    system.savingThrows.cognitive.bonus += tier;
  }
}

export function racialResourceView093(actor, combat = globalThis.game?.combat) {
  const { system } = actor;
  const b = racialResourceBonuses093(system, system.tier || 1);
  const state = resources(system);
  const key = roundKey(actor, combat);
  const round = state.pressureRound === key ? state : {};
  const hasAttackCheck = has(system, 'Demonic Pressure');
  const hasPhantomSteadfast = has(system, 'Fallen Idol', 3);
  const demon = hasPhantomSteadfast || hasAttackCheck || pressure(system) || resilience(system) || has(system, 'Demonic Resilience', 4);
  const inCombat = inCombat093(actor, combat);
  return {
    show: demon || overwhelmEnabled(system), demon, pressure: pressure(system),
    arcosian: overwhelmEnabled(system), inCombat,
    hasAttackCheck, hasPhantomSteadfast,
    hasDefenseCheck: resilience(system), hasSteadfastCheck: has(system, 'Demonic Resilience', 4),
    canAttack: hasAttackCheck && (!inCombat || isOwnTurn093(actor, combat)) && count(round.attackChecks) < 3,
    canDefend: count(round.defenseChecks) < maxResilienceSuccesses,
    canSteadfast: !state.steadfastCheckUsed,
    canUseCreativity: has(system, 'Demonic Creativity', 4) && state.creativeRound !== key && count(state.creativeUses) < 3,
    makyanPower: pressure(system) && has(system, 'Demons of the Makyo Star', 5),
    canUseMakyanPower: state.makyanPowerRound !== key && count(state.makyanPowerUses) < 3,
    attackChecks: count(round.attackChecks),
    defenseChecks: count(round.defenseChecks),
    overwhelmMaxed: b.overwhelm >= 4,
    overwhelmPips: Array.from({ length: 4 }, (_, index) => index < b.overwhelm),
    overwhelmWound: b.overwhelm * (system.tier || 1),
    ...b
  };
}

export function pressureResult093(roll, { denizen = false, makyan = false, creative = false } = {}) {
  const score = Math.max(0, roll + Number(denizen) - 2 * Number(makyan));
  const success = score >= 4;
  return {
    score, success,
    power: success ? 1 + Number(makyan) : 0,
    fatigue: success ? 0 : 1 + Number(creative)
  };
}

function pressureAvailable(actor, source, combat) {
  const view = racialResourceView093(actor, combat);
  if (source === 'attack') return has(actor.system, 'Demonic Pressure') && view.canAttack;
  if (source === 'defense') return view.hasDefenseCheck && view.canDefend;
  return source === 'steadfast' && view.hasSteadfastCheck && view.canSteadfast;
}

const healthThresholds = ['bruised', 'injured', 'critical'];
function failedThreshold(system, key) {
  const threshold = system.thresholds?.[key];
  return healthThresholds.includes(key) && threshold?.crossed && !threshold.checked && !threshold.steadfast;
}

export async function promptPressureCheck093(actor, source, combat = globalThis.game?.combat) {
  if (!actor?.isOwner && !globalThis.game?.user?.isGM) return;
  const triggers = [
    ['attack', 'Após atacar no próprio turno'],
    ['defense', 'Ao ser alvo de um ataque'],
    ['steadfast', 'Após falhar Steadfast']
  ].filter(([key]) => (!source || key === source) && pressureAvailable(actor, key, combat));
  if (!triggers.length) {
    ui.notifications.warn('Pressure Check indisponível neste turno ou rodada.');
    return;
  }
  const { system } = actor;
  const view = racialResourceView093(actor, combat);
  const modifiers = [
    [has(system, 'Denizen of the Demon Realm'), 'denizen', '+1 enquanto um oponente sofre uma Combat Condition que você causou'],
    [view.canUseCreativity, 'creative', 'Demonic Creativity · 2d10, use o maior'],
    [has(system, 'Demons of the Makyo Star', 4), 'makyan', 'Makyan · −2 no teste, +1 Power se passar']
  ].filter(([enabled]) => enabled);
  const thresholds = source === 'steadfast' ? healthThresholds.filter(key => failedThreshold(system, key)) : [];
  const chooseTrigger = !source;
  const selection = chooseTrigger || modifiers.length || thresholds.length ? await Dialog.wait({
    title: 'Pressure Check',
    content: [
      ...(chooseTrigger ? [`<label>Gatilho <select name="trigger">${triggers.map(([key, label]) =>
        `<option value="${key}">${label}</option>`).join('')}</select></label>`] : []),
      ...(thresholds.length ? [`<label>Steadfast <select name="threshold"><option value="">Outro teste</option>${thresholds.map(key =>
        `<option value="${key}">${key}</option>`).join('')}</select></label>`] : []),
      ...modifiers.map(([, name, label]) => `<div><label><input type="checkbox" name="${name}"> ${label}</label></div>`)
    ].join(''),
    buttons: {
      roll: { label: 'Rolar', callback: root => ({
        trigger: source || root.find('[name="trigger"]').val(),
        options: { threshold: root.find('[name="threshold"]').val(),
          ...Object.fromEntries(modifiers.map(([, name]) => [name, !!root.find(`[name="${name}"]`).prop('checked')])) }
      }) },
      cancel: { label: 'Cancelar', callback: () => null }
    },
    default: 'roll',
    close: () => null
  }) : { trigger: source, options: {} };
  if (!selection) return;
  const result = await rollPressure093(actor, selection.trigger, selection.options, combat);
  if (!result) ui.notifications.warn('Pressure Check indisponível neste turno ou rodada.');
  return result;
}

function makyanRegen(system, before, gained) {
  if (!gained || !has(system, 'Demons of the Makyo Star', 3)) return {};
  const tier = system.tier || 1;
  const gainsMight = before < 2 && before + gained >= 2 && has(system, 'Demonic Pressure', 6);
  const might = (system.status?.might || 0) + (gainsMight ? tier : 0);
  const current = system.kiPool?.value || 0;
  const max = system.kiPool?.max ?? current;
  return { 'system.kiPool.value': Math.min(max, current + gained * Math.ceil(might / 4)) };
}

export async function rollPressure093(actor, source, options = {}, combat = globalThis.game?.combat) {
  if (pending.has(actor) || !pressureAvailable(actor, source, combat)) return null;
  pending.add(actor);
  try {
    const key = roundKey(actor, combat);
    const turn = combat?.combatant?.id;
    const state = resources(actor.system);
    const creative = !!options.creative && has(actor.system, 'Demonic Creativity', 4)
      && state.creativeRound !== key && count(state.creativeUses) < 3;
    const denizen = !!options.denizen && has(actor.system, 'Denizen of the Demon Realm');
    const makyan = !!options.makyan && has(actor.system, 'Demons of the Makyo Star', 4);
    const roll = await new Roll(creative ? '2d10kh' : '1d10').evaluate();
    if (key !== roundKey(actor, combat) || turn !== combat?.combatant?.id || !pressureAvailable(actor, source, combat)) return null;

    const live = resources(actor.system);
    const result = pressureResult093(roll.total, { denizen, makyan, creative });
    const resetRound = live.pressureRound !== key;
    const values = resetRound ? { pressureRound: key, attackChecks: 0, defenseChecks: 0 } : {};
    if (source === 'attack') values.attackChecks = (resetRound ? 0 : count(live.attackChecks)) + 1;
    if (source === 'defense') {
      values.defenseChecks = (resetRound ? 0 : count(live.defenseChecks)) + 1;
      if (result.success) {
        values.resilienceSuccesses = Math.min(maxResilienceSuccesses, resilienceSuccesses(live) + 1);
      }
    }
    if (source === 'steadfast') values.steadfastCheckUsed = true;
    if (creative) {
      values.creativeRound = key;
      values.creativeUses = count(live.creativeUses) + 1;
    }

    let regen = {};
    if (pressure(actor.system)) {
      const before = count(live.demonicPower);
      if (result.power) values.demonicPower = before + result.power;
      if (result.fatigue) values.demonicFatigue = count(live.demonicFatigue) + result.fatigue;
      regen = makyanRegen(actor.system, before, result.power);
    }
    const changes = { ...updateFields(values), ...regen };
    if (source === 'steadfast' && result.success && failedThreshold(actor.system, options.threshold)) {
      changes[`system.thresholds.${options.threshold}.checked`] = true;
    }
    await actor.update(changes);

    const outcome = result.success ? 'Sucesso' : 'Falha';
    const gain = pressure(actor.system) ? (result.success ? ` · +${result.power} Demonic Power` : ` · +${result.fatigue} Demonic Fatigue`) : '';
    const replacement = source === 'steadfast' && result.success ? ' · trate o Steadfast Check como sucesso' : '';
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Pressure Check · ${result.score} · ${outcome}${gain}${makyan ? ' · Makyan (−2)' : ''}${replacement}`
    });
    return result;
  } finally {
    pending.delete(actor);
  }
}

export async function rollPhantomSteadfast093(actor) {
  const system = actor.system;
  if (!has(system, 'Fallen Idol', 3)) return;
  const { steadfast } = racialResourceBonuses093(system, system.tier || 1);
  const bonus = (system.aptitudes?.steadfastBonus ?? steadfast)
    + (system.talentBonuses?.totals?.steadfast || 0) + (system.legendaryTraitBonuses?.totals?.steadfast || 0);
  const roll = await new Roll('1d10 + @bonus', { bonus }).evaluate();
  return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Steadfast · Fallen Idol +${steadfast} · alvo 6+` });
}

export async function adjustRacialResource093(actor, key, delta) {
  if (![-1, 1].includes(delta)) return;
  const state = resources(actor.system);
  if (key === 'overwhelm' && overwhelmEnabled(actor.system)) {
    await actor.update(updateFields({ overwhelm: Math.max(0, Math.min(4, count(state.overwhelm) + delta)) }));
  } else if (['demonicPower', 'demonicFatigue'].includes(key) && pressure(actor.system)) {
    const before = count(state[key]);
    await actor.update({
      ...updateFields({ [key]: Math.max(0, before + delta) }),
      ...(key === 'demonicPower' && delta > 0 ? makyanRegen(actor.system, before, delta) : {})
    });
  }
}

export async function useMakyanPower093(actor, combat = globalThis.game?.combat) {
  const view = racialResourceView093(actor, combat);
  if (!view.makyanPower || !view.canUseMakyanPower) return false;
  const state = resources(actor.system);
  const power = count(state.demonicPower);
  await actor.update({
    ...updateFields({ demonicPower: power + 1, makyanPowerRound: roundKey(actor, combat),
      makyanPowerUses: count(state.makyanPowerUses) + 1 }),
    ...makyanRegen(actor.system, power, 1)
  });
  return true;
}

export function racialTurnReset093(system, phase) {
  if (!uses093(system)) return {};
  const state = resources(system);
  const changes = {};
  if (phase === 'start') {
    if (has(system, 'Demonic Pressure', 3)) {
      if (state.demonicPower) changes.demonicPower = 0;
      if (state.demonicFatigue) changes.demonicFatigue = 0;
    }
    if (state.resilienceSuccesses) changes.resilienceSuccesses = 0;
    if (state.resilienceActive) changes.resilienceActive = false;
  } else if (phase === 'end' && state.overwhelm) {
    changes.overwhelm = 0;
  }
  return updateFields(changes);
}

export function racialEncounterReset093(system) {
  if (!uses093(system) || !Object.keys(resources(system)).length) return {};
  return updateFields({
    demonicPower: 0, demonicFatigue: 0, overwhelm: 0, resilienceActive: false, resilienceSuccesses: 0,
    pressureRound: '', attackChecks: 0, defenseChecks: 0, steadfastCheckUsed: false,
    creativeRound: '', creativeUses: 0, makyanPowerRound: '', makyanPowerUses: 0
  });
}

export async function updateRacialTurn093(combat) {
  const previous = combat.previous;
  const current = combat.current;
  if (previous?.combatantId === current?.combatantId && previous?.round === current?.round && previous?.turn === current?.turn) return;
  const outgoing = combat.combatants?.get(previous?.combatantId)?.actor;
  const incoming = combat.combatant?.actor;
  for (const actor of new Set([outgoing, incoming])) {
    if (!actor) continue;
    const updates = {
      ...(actor === outgoing ? racialTurnReset093(actor.system, 'end') : {}),
      ...(actor === incoming ? racialTurnReset093(actor.system, 'start') : {})
    };
    if (Object.keys(updates).length) await actor.update(updates);
  }
}

export async function clearCombatRacialResources093(combat) {
  for (const actor of new Set(Array.from(combat.combatants || [], c => c.actor))) {
    if (!actor) continue;
    const updates = racialEncounterReset093(actor.system);
    if (Object.keys(updates).length) await actor.update(updates);
  }
}
