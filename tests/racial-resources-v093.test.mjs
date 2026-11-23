import test from 'node:test';
import assert from 'node:assert/strict';
import { adjustRacialResource093, applyRacialResources093, clearCombatRacialResources093, pressureResult093, racialResourceView093, rollPressure093, updateRacialTurn093 } from '../module/rules/racial-resources-v093.mjs';
import { applyCatalogPassives093, racialLife093 } from '../module/rules/runtime-v093.mjs';
import { talentPassiveBonus093, TALENT_PASSIVES_093 } from '../module/rules/talent-passives-v093.mjs';
import { CATALOGS_093 } from '../module/rules/catalogs-v093.mjs';
import { racialTrackerTraits093 } from '../module/rules/racial-tracker-v093.mjs';

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
        assert.ok(key.startsWith(source));
        this.system.rules093State.racialResources[key.slice(source.length)] = value;
      }
    }
  };
}

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
  assert.equal(demon.system.aptitudes.defenseValue, 8);
  assert.equal(demon.system.status.soak, 10);
  assert.equal(demon.system.status.might, 10);
  assert.equal(demon.system.status.mightForClashes, 11);
  assert.equal(demon.system.status.dr, 4);
  assert.equal(demon.system.aptitudes.steadfastBonus, 2);
});

test('Pressure rolls grant the matching resource with independent offensive and defensive round limits', async () => {
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
