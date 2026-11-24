import test from 'node:test';
import assert from 'node:assert/strict';
import { adjustRacialResource093, applyRacialResources093, clearCombatRacialResources093, racialTurnReset093, pressureResult093, racialResourceView093, rollPhantomSteadfast093, useMakyanPower093, rollPressure093, updateRacialTurn093 } from '../module/rules/racial-resources-v093.mjs';
import { applyCatalogPassives093, racialLife093 } from '../module/rules/runtime-v093.mjs';
import { talentPassiveBonus093, TALENT_PASSIVES_093 } from '../module/rules/talent-passives-v093.mjs';
import { CATALOGS_093 } from '../module/rules/catalogs-v093.mjs';
import { racialTrackerTraits093 } from '../module/rules/racial-tracker-v093.mjs';
import { RACIAL_PASSIVES_093, racialPassiveBonuses093 } from '../module/rules/racial-passives-v093.mjs';
import { Collection } from './helpers/automation-environment.mjs';

const source = 'system.rules093State.racialResources.';
function actor(race, selected, resources = {}) {
  return {
    uuid: `Actor.${race}`,
    system: { race, rulesVersion: '0.9.3', tier: 2,
      racialTraits: selected.map(name => CATALOGS_093.racialTraits[race].find(row => row.name === name).id),
      rules093State: { racialResources: resources },
      aptitudes: { defenseValue: 10 },
      status: { soak: 8, might: 8, mightForClashes: 9 }
    },
    async update(fields) {
      for (const [key, value] of Object.entries(fields)) {
        if (key === 'system.kiPool.value') { this.system.kiPool.value = value; continue; }
        if (key === 'system.thresholds.injured.checked') { this.system.thresholds.injured.checked = value; continue; }
        assert.ok(key.startsWith(source));
        this.system.rules093State.racialResources[key.slice(source.length)] = value;
      }
    }
  };
}

test('racial stat automation uses only catalogued passives and respects selection and Tier', () => {
  const traits = new Map(Object.values(CATALOGS_093.racialTraits).flat().map(trait => [trait.id, trait]));
  for (const [id, rules] of Object.entries(RACIAL_PASSIVES_093)) {
    const trait = traits.get(id);
    assert.ok(trait, id);
    for (const rule of rules) {
      const levels = trait.effects.filter(effect => effect.level === rule.level);
      const effects = rule.option
        ? levels.flatMap(effect => effect.options || []).filter(option => option.name === rule.option)
        : levels;
      assert.ok(effects.some(effect => effect.keyword === 'Passive'), `${trait.name} ${rule.level} ${rule.option || ''}`);
    }
  }
  const armor = 'r093_cybernetic_enhancement_armor_plating';
  const psychic = 'r093_mutation_psychic';
  const computer = 'r093_cybernetic_enhancement_mental_supercomputer';
  const heran = 'r093_herans_brigand_combat';
  const system = {
    rulesVersion: '0.9.3', racialTraits: [armor, psychic, computer, heran, armor],
    tracking: { powerStacks: 1 },
    racialOptionSelections: { [heran]: { 3: 'Riches of Mysticism' } },
  };
  const totals = () => racialPassiveBonuses093(system, 3, 2);
  assert.deepEqual(totals(), { racialLife: 2, dr: 2, in: 3, cognitiveSave: 3 });
  system.tracking.powerStacks = 2;
  system.racialOptionSelections[heran][3] = 'Riches of Might';
  assert.deepEqual(totals(), { racialLife: 5, dr: 2, in: 3, cognitiveSave: 3, sc: 3, pe: 3, might: 3 });
  system.rulesVersion = '0.9.2';
  assert.deepEqual(totals(), {});
});

test('tracker counts each selected combat trait once for the current race and subrace', () => {
  const catalog = CATALOGS_093.racialTraits;
  const demon = name => catalog.demon.find(trait => trait.name === name);
  const pressure = demon('Demonic Pressure');
  const makyan = demon('Demons of the Makyo Star');
  const phantom = demon('Fallen Idol');
  const refinedCombat = structuredClone(catalog.namekian.find(trait => trait.name === 'Refined Combat'));
  const combatOptions = refinedCombat.effects.find(effect => effect.options).options.slice(0, 2);
  const traits = [pressure, pressure, makyan, phantom, refinedCombat, catalog.saiyan[0], catalog.factors[0]];
  const system = { race: 'demon', subrace: 'Demon Person', racialTraits: traits.map(trait => trait.id) };
  const names = () => racialTrackerTraits093(system, traits).map(trait => trait.name);
  assert.deepEqual(names(), ['Demonic Pressure']);
  system.subrace = 'Makyan';
  assert.deepEqual(names(), ['Demonic Pressure', 'Demons of the Makyo Star']);
  system.racialTraits = system.racialTraits.filter(id => id !== pressure.id);
  assert.deepEqual(names(), ['Demons of the Makyo Star']);
  system.subrace = 'Phantom';
  assert.deepEqual(names(), ['Fallen Idol']);
  system.race = 'namekian';
  system.subrace = 'Warrior Clan';
  assert.deepEqual(names(), []);
  for (const option of combatOptions) option.selected = true;
  assert.deepEqual(names(), ['Refined Combat']);
  assert.deepEqual(racialTrackerTraits093(system, traits)[0].effects.map(effect => effect.name),
    combatOptions.map(option => option.name));
  system.subrace = 'Dragon Clan';
  assert.deepEqual(names(), []);
});

test('Demonic Power, Fatigue and Phantom bonuses apply to the actual derived statistics', () => {
  const demon = actor('demon', ['Demonic Pressure', 'Demonic Resilience', 'Fallen Idol'],
    { demonicPower: 2, demonicFatigue: 1, resilienceActive: true });
  applyRacialResources093(demon.system, 2);
  assert.equal(demon.system.aptitudes.woundBuffTotal, 8);
  const view = racialResourceView093(demon);
  assert.equal(view.defensePenalty, 2);
  assert.equal(view.soak, 2);
  assert.equal(demon.system.status.might, 10);
  assert.equal(demon.system.status.mightForClashes, 11);
  assert.equal(view.dr, 4);
  assert.equal(view.steadfast, 2);
});

test('Pressure rolls grant the matching resource with independent offensive and defensive round limits', async () => {
  assert.deepEqual(pressureResult093(1, { makyan: true }), { score: 0, success: false, power: 0, fatigue: 1 });
  assert.deepEqual(pressureResult093(3, { denizen: true }), { score: 4, success: true, power: 1, fatigue: 0 });
  assert.deepEqual(pressureResult093(3, { creative: true }), { score: 3, success: false, power: 0, fatigue: 2 });
  assert.deepEqual(pressureResult093(6, { makyan: true }), { score: 4, success: true, power: 2, fatigue: 0 });
  let die = 4;
  globalThis.Roll = class { async evaluate() { this.total = die; return this; } async toMessage() {} };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  const demon = actor('demon', ['Demonic Pressure', 'Demonic Resilience']);
  const demonTurn = { id: 'demon', actor: demon };
  const combat = { id: 'c1', round: 1, combatants: [demonTurn], combatant: demonTurn };
  for (let i = 0; i < 3; i++) assert.ok(await rollPressure093(demon, 'attack', {}, combat));
  assert.equal(await rollPressure093(demon, 'attack', {}, combat), null);
  die = 3;
  assert.ok(await rollPressure093(demon, 'defense', {}, combat));
  assert.ok(await rollPressure093(demon, 'defense', {}, combat));
  assert.equal(await rollPressure093(demon, 'defense', {}, combat), null);
  assert.equal(racialResourceView093(demon, combat).power, 3);
  assert.equal(racialResourceView093(demon, combat).fatigue, 2);
  combat.combatant = { id: 'other', actor: { uuid: 'Actor.other' } };
  combat.round++;
  assert.equal(await rollPressure093(demon, 'attack', {}, combat), null);
  assert.ok(await rollPressure093(demon, 'defense', {}, combat));
});

test('turns clear the outgoing Overwhelm and incoming Demonic resources independently', async () => {
  const arcosian = actor('arcosian', ['Overwhelming Fighter'], { overwhelm: 4 });
  await adjustRacialResource093(arcosian, 'overwhelm', 1);
  assert.equal(racialResourceView093(arcosian).overwhelm, 4);
  applyRacialResources093(arcosian.system, 2);
  assert.equal(arcosian.system.aptitudes.woundBuffTotal, 8);
  const demon = actor('demon', ['Demonic Pressure'],
    { demonicPower: 3, demonicFatigue: 1, attackChecks: 2, steadfastCheckUsed: true });
  const combatant = { actor: demon };
  const combat = { previous: { round: 1, combatantId: 'a' }, current: { round: 1, combatantId: 'b' },
    combatant, combatants: new Map([['a', { actor: arcosian }], ['b', combatant]]) };
  await updateRacialTurn093(combat);
  assert.equal(racialResourceView093(arcosian).overwhelm, 0);
  assert.equal(demon.system.rules093State.racialResources.demonicPower, 0);
  assert.equal(demon.system.rules093State.racialResources.demonicFatigue, 0);
  assert.equal(demon.system.rules093State.racialResources.attackChecks, 2);
  // Foundry Collections iterate values.
  await clearCombatRacialResources093({ combatants: combat.combatants.values() });
  assert.equal(demon.system.rules093State.racialResources.steadfastCheckUsed, false);
});

test('defensive Pressure grants 2(T) per success up to 4(T) until the demon’s next turn', async () => {
  let die = 4;
  globalThis.Roll = class { async evaluate() { this.total = die; return this; } async toMessage() {} };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  const demon = actor('demon', ['Demonic Pressure', 'Demonic Resilience']);
  const defender = { id: 'demon', actor: demon };
  const attacker = { id: 'other', actor: actor('arcosian', []) };
  const combat = {
    id: 'c2', round: 1, combatant: attacker,
    combatants: new Collection([[defender.id, defender], [attacker.id, attacker]])
  };
  const dr = () => racialResourceView093(demon, combat).dr;
  assert.ok(await rollPressure093(demon, 'defense', {}, combat));
  assert.equal(dr(), 4);
  die = 3;
  assert.ok(await rollPressure093(demon, 'defense', {}, combat));
  assert.equal(dr(), 4);
  assert.equal(await rollPressure093(demon, 'defense', {}, combat), null);

  combat.round++;
  die = 4;
  assert.ok(await rollPressure093(demon, 'defense', {}, combat));
  assert.equal(dr(), 8);
  assert.ok(await rollPressure093(demon, 'defense', {}, combat));
  assert.equal(dr(), 8);

  combat.previous = { round: 2, combatantId: attacker.id };
  combat.current = { round: 2, combatantId: defender.id };
  combat.combatant = defender;
  await updateRacialTurn093(combat);
  assert.equal(dr(), 0);
  assert.equal(await rollPressure093(demon, 'defense', {}, combat), null);
  combat.round++;
  assert.ok(await rollPressure093(demon, 'defense', {}, combat));
  assert.equal(dr(), 4);
  await clearCombatRacialResources093({ combatants: combat.combatants.values() });
  assert.equal(dr(), 0);
});

test('automated talent effects are listed passives and honor their individual toggles', () => {
  for (const [id, levels] of Object.entries(TALENT_PASSIVES_093)) {
    const talent = CATALOGS_093.talents.find(row => row.id === id);
    assert.ok(talent);
    for (const level of Object.keys(levels)) {
      assert.equal(talent.effects.find(row => row.level === Number(level)).activationType, 'passive', talent.name);
    }
  }
  const system = { rulesVersion: '0.9.3', race: 'saiyan', tier: 3, baseTier: 2,
    talents: ['r093_rapid_fist', 'r093_saiyan_soul', 'r093_risky_bet', 'r093_angelic_technique', 'r093_alert'],
    status: { soak: 5 }, aptitudes: {}, thresholds: { injured: { crossed: true } },
    effectTracking: { enabledPassives: { talent_r093_rapid_fist_1: false } }
  };
  applyCatalogPassives093(system, 3, 2);
  assert.equal(system.aptitudes.strikePhysical, undefined);
  assert.equal(system.aptitudes.initiativeValue, 2);
  assert.equal(system.status.soak, 7);
  assert.equal(racialLife093(system), 5);
  assert.equal(talentPassiveBonus093(system, 'tpPerSkillImprovement'), 2);
});

test('Creativity resolves a single check after keep-highest and subrace modifiers', async () => {
  let dice, formula, messages = 0;
  globalThis.Roll = class {
    constructor(expression) { formula = expression; }
    async evaluate() { this.total = formula === '2d10kh' ? Math.max(...dice) : dice[0]; return this; }
    async toMessage() { messages++; }
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  const demon = actor('demon', ['Demonic Pressure', 'Demonic Creativity', 'Demonic Resilience',
    'Demons of the Makyo Star', 'Denizen of the Demon Realm', 'Fallen Idol']);
  demon.system.subrace = 'Makyan';
  demon.system.kiPool = { value: 1, max: 8 };
  const state = demon.system.rules093State.racialResources;
  const token = { actor: demon, id: 'd' };
  const combat = { id: 'c', round: 1, combatants: [token], combatant: token };
  const check = (options) => rollPressure093(demon, 'attack', options, combat);
  dice = [2, 4];
  assert.deepEqual(await check({ creative: true }), { score: 4, success: true, power: 1, fatigue: 0 });
  assert.equal(formula, '2d10kh'); assert.equal(messages, 1);
  assert.equal(state.attackChecks, 1); assert.equal(state.creativeUses, 1);
  assert.equal(demon.system.kiPool.value, 3);
  dice = [2, 9];
  await check({ creative: true });
  assert.equal(formula, '1d10'); assert.equal(state.creativeUses, 1);
  combat.round++;
  dice = [3, 5];
  assert.deepEqual(await check({ creative: true, makyan: true, denizen: true }),
    { score: 3, success: false, power: 0, fatigue: 2 });
  assert.equal(demon.system.kiPool.value, 3);
  combat.round++;
  dice = [1, 6];
  assert.deepEqual(await check({ creative: true, makyan: true }), { score: 4, success: true, power: 2, fatigue: 0 });
  assert.equal(demon.system.kiPool.value, 8);
  assert.equal(racialResourceView093(demon, combat).steadfast, 0);
  combat.round++;
  assert.equal(racialResourceView093(demon, combat).canUseCreativity, false);
  demon.system.subrace = 'Demon Person';
  dice = [3];
  assert.equal((await check({ creative: true, denizen: true, makyan: true })).power, 1);
  assert.equal(formula, '1d10');
  assert.equal(racialResourceView093(demon, combat).combatRolls, 0);
  assert.equal(await useMakyanPower093(demon, combat), false);
  demon.system.subrace = 'phantom';
  let bonus;
  globalThis.Roll = class {
    constructor(expression, data) { assert.equal(expression, '1d10 + @bonus'); bonus = data.bonus; }
    async evaluate() { return this; } async toMessage() {}
  };
  await rollPhantomSteadfast093(demon);
  assert.equal(bonus, state.demonicPower);
});

test('Makyan Power and Steadfast replacement have independent encounter limits', async () => {
  globalThis.Roll = class { async evaluate() { this.total = 4; return this; } async toMessage() {} };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  const demon = actor('demon', ['Demonic Pressure', 'Demonic Resilience', 'Demons of the Makyo Star']);
  demon.system.subrace = 'Makyan';
  demon.system.kiPool = { value: 0, max: 4 };
  const token = { actor: demon, id: 'd' };
  const combat = { id: 'c', round: 1, combatants: [token], combatant: token };
  for (let i = 0; i < 3; i++, combat.round++) {
    assert.equal(await useMakyanPower093(demon, combat), true);
    assert.equal(await useMakyanPower093(demon, combat), false);
  }
  assert.equal(await useMakyanPower093(demon, combat), false);
  assert.equal(demon.system.kiPool.value, 4);
  demon.system.thresholds = { injured: { crossed: true, checked: false } };
  assert.ok(await rollPressure093(demon, 'steadfast', { threshold: 'injured' }, combat));
  assert.equal(demon.system.thresholds.injured.checked, true);
  assert.equal(await rollPressure093(demon, 'steadfast', {}, combat), null);
  assert.equal(demon.system.rules093State.racialResources.demonicPower, 4);
  await clearCombatRacialResources093(combat);
  assert.equal(demon.system.rules093State.racialResources.demonicPower, 0);
  assert.equal(racialResourceView093(demon, combat).canUseMakyanPower, true);
});

test('an explicitly suppressed start-of-turn reset does not extend Resilience DR', () => {
  const demon = actor('demon', ['Demonic Pressure', 'Demonic Resilience'],
    { demonicPower: 2, demonicFatigue: 1, resilienceActive: true });
  demon.system.effectTracking = { enabledPassives: { racial_primary_demonic_pressure_3: false } };
  assert.deepEqual(racialTurnReset093(demon.system, 'start'), { [source + 'resilienceActive']: false });
});

test('two simultaneous clicks on the same actor resolve one Pressure Check', async () => {
  let messages = 0;
  globalThis.Roll = class { async evaluate() { this.total = 4; return this; } async toMessage() { messages++; } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  const demon = actor('demon', ['Demonic Pressure']);
  const results = await Promise.all([rollPressure093(demon, 'attack'), rollPressure093(demon, 'attack')]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(messages, 1);
  assert.equal(demon.system.rules093State.racialResources.demonicPower, 1);
  assert.equal(demon.system.rules093State.racialResources.attackChecks, 1);
});
