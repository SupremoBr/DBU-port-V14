import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIQUE_ABILITIES_DATA } from '../module/data/unique-abilities-catalog.mjs';
import { uniqueAbilityCatalog093, uniqueAbilityOptions, uniqueAbilityUsage, uniqueCombatPassives093, uniqueSkillPassives093 } from '../module/rules/unique-abilities-v093.mjs';
import { uniquePowersMethods } from '../module/sheets/character/unique-powers.mjs';

import { computeSkillBonus } from '../module/helpers/duel.mjs';
import { progressionSkillsMethods } from '../module/sheets/character/progression-skills.mjs';

const catalog = uniqueAbilityCatalog093(UNIQUE_ABILITIES_DATA);
globalThis.CONFIG = { DBU: { uniqueAbilitiesCatalog: catalog } };
globalThis.foundry = { utils: { deepClone: structuredClone } };

test('official Unique Abilities have summaries, costs and links alongside preserved legacy entries', () => {
  const current = Object.values(catalog).filter(row => !row.legacy);
  assert.equal(current.length, 66);
  assert.ok(current.every(row => row.effect && row.source.startsWith('https://dbu-rpg.com/unique-abilities/')));
  assert.equal(current.flatMap(row => row.advancements).filter(row => !row.legacy).length, 100);
  assert.equal(current.flatMap(row => row.restrictions).filter(row => !row.legacy).length, 16);
  assert.equal(catalog.binding.tpCost, 20);
  assert.equal(catalog.telekinesis.kpCost, '6(T)');
  assert.equal(catalog.time_freeze.kpCost, '14(bT)');
  assert.equal(catalog.mafuba.legacy, true);
  assert.equal(catalog.sealing.restrictions.find(row => row.id === 'mafuba').tpCost, -5);
  assert.ok(catalog.binding.advancements.find(row => row.id === 'galactic_donut').legacy);
  assert.ok(!uniqueAbilityOptions(catalog.binding).advancements.some(row => row.id === 'galactic_donut'));
});

test('sheet uses current costs, presents saved legacy advancements and filters locked options', () => {
  const system = {
    rulesVersion: '0.9.3', tier: 3, baseTier: 2,
    aptitudes: { kiCostUniqueTechnical: -20 },
    uniqueAbilities: [{
      abilityKey: 'binding',
      abilityType: 'Technical',
      advancements: [{ advancementId: 'galactic_donut' }],
      restrictions: [{ restrictionId: 'gentle_hold' }]
    }]
  };
  const sheet = { ...uniquePowersMethods, actor: { _getActiveAura: () => null } };
  const context = {};
  sheet._prepareUniqueData(context, system);
  const [binding] = context.characterUniques;
  assert.equal(binding.chooseType, true);
  assert.equal(binding.kpResolved, 30);
  assert.equal(binding.kpEffective, 15);
  assert.equal(binding.tpCost, 21);
  assert.equal(binding.selectedAdvancements[0].name, 'Galactic Donut');
  assert.equal(binding.selectedAdvancements[0].unavailable, true);
  assert.ok(!binding.availableAdvancements.some(option => option.id === 'binding_volley'));
  assert.equal(sheet._calcUniqueTotalTP(system), 21);
});

test('a free Unique Ability still charges for paid advancements', () => {
  const sheet = { ...uniquePowersMethods };
  const free = { abilityKey: 'binding', free: true,
    advancements: [{ advancementId: 'psychic_grip' }, { advancementId: 'energy_web', free: true }],
    restrictions: [{ restrictionId: 'gentle_hold' }] };
  assert.equal(sheet._calcUniqueTPCost(free, catalog.binding), 5);
  assert.equal(sheet._calcUniqueTotalTP({ uniqueAbilities: [free] }), 5);
  assert.equal(sheet._calcUniqueTPCost({ ...free, free: false }, catalog.binding), 20);
});

test('Shapeshift uses base Tier for activation and recovery, and current Tier for the Diploma discount', () => {
  const system = { rulesVersion: '0.9.3', tier: 3, baseTier: 2,
    uniqueAbilities: [{ abilityKey: 'shapeshift', advancements: [] }] };
  assert.deepEqual(uniquePowersMethods._shapeshiftCosts(system), { kpActivate: 16, kpSustain: 8, kpRegain: 12 });
  system.uniqueAbilities[0].advancements.push({ advancementId: 'shapeshift_diploma' });
  assert.deepEqual(uniquePowersMethods._shapeshiftCosts(system), { kpActivate: 10, kpSustain: 5, kpRegain: 12 });
  assert.deepEqual(uniquePowersMethods._shapeshiftCosts({ ...system, rulesVersion: '0.9.2' }),
    { kpActivate: 18, kpSustain: 9, kpRegain: 18 });
});

test('the combat tracker supports encounter limits and Petrification Barrage ranks', () => {
  assert.deepEqual(uniqueAbilityUsage(catalog.fake_death, {}), { usageLimit: 'encounter', maxUses: 1 });
  assert.deepEqual(uniqueAbilityUsage(catalog.petrification, {
    advancements: [{ advancementId: 'petrification_barrage', amount: 2 }]
  }), { usageLimit: 'round', maxUses: 3 });
  assert.deepEqual(uniqueAbilityUsage(catalog.barrier, {}), { usageLimit: 'round', maxUses: 1 });
});

test('combat passives scale with Tier and recalculate when access changes', () => {
  const actor = { system: { rulesVersion: '0.9.3', uniqueAbilities: [
    { abilityKey: 'dragon_dash' }, { abilityKey: 'precognition' }, { abilityKey: 'dragon_dash' }
  ] } };
  assert.deepEqual(uniqueCombatPassives093(actor, actor.system, 3), { boostedSpeed: 3, initiative: 3 });
  actor.system.uniqueAbilities.shift();
  assert.deepEqual(uniqueCombatPassives093(actor, actor.system, 1), { boostedSpeed: 1, initiative: 1 });
  actor.system.uniqueAbilities.pop();
  assert.deepEqual(uniqueCombatPassives093(actor, actor.system, 1), { boostedSpeed: 0, initiative: 1 });
  actor.system.rulesVersion = '0.9.2';
  assert.deepEqual(uniqueCombatPassives093(actor, actor.system, 3), { boostedSpeed: 0, initiative: 0 });
});

test('Skill Bonuses and check modifiers apply separately in the sheet and together in Skill Clashes', async t => {
  const actor = { _getBuffTotal: () => 0, system: {
    rulesVersion: '0.9.3', skillMisc: { bluff: 2 }, uniqueAbilities: [
      'bluff_attack', 'down_burst', 'illusion', 'healing_hands', 'metamoran_fusion_dance', 'para_para_dance'
    ].map(abilityKey => ({ abilityKey }))
  } };
  const sheet = { ...progressionSkillsMethods, actor, _scaleDiceByTier: formula => formula };
  assert.equal(sheet._calcSkillBreakdown('bluff').total, 4);
  assert.equal(computeSkillBonus(actor, 'bluff'), 5);
  assert.equal(sheet._calcSkillBreakdown('concealment').total, 1);
  assert.equal(sheet._calcSkillBreakdown('medicine').total, 0);
  assert.equal(computeSkillBonus(actor, 'medicine'), 1);
  assert.deepEqual(uniqueSkillPassives093(actor, 'performance'), { bonus: 0, check: 1, critical: 1 });
  const content = [];
  const globals = { Roll: globalThis.Roll, ChatMessage: globalThis.ChatMessage, game: globalThis.game };
  t.after(() => Object.assign(globalThis, globals));
  globalThis.game = {};
  globalThis.Roll = class {
    constructor(formula) { this.formula = formula; }
    async evaluate() {
      this.dice = [{ results: [{ result: 9 }] }];
      this.total = this.formula === '1d4' ? 2 : 10;
    }
  };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async message => content.push(message.content) };
  const event = { preventDefault() {}, currentTarget: { dataset: { skill: 'performance' } } };
  await sheet._onRollSkill(event);
  assert.match(content[0], /1d10\+1/);
  assert.match(content[0], /CT 9\+.*CRIT/);
});
