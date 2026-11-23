import test from 'node:test';
import assert from 'node:assert/strict';
import { UNIQUE_ABILITIES_DATA } from '../module/data/unique-abilities-catalog.mjs';
import { uniqueAbilityCatalog093, uniqueAbilityOptions, uniqueAbilityUsage } from '../module/rules/unique-abilities-v093.mjs';
import { uniquePowersMethods } from '../module/sheets/character/unique-powers.mjs';

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
