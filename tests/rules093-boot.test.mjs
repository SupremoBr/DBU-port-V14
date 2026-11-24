import test from 'node:test';
import assert from 'node:assert/strict';

test('the real system init installs the current catalogs, schema, sheet adapter and migration before ready',async t=>{
  const hooks=new Map(), events=[], callbacks=new Map();
  globalThis.Hooks={once(name,fn){hooks.set(name,fn);return name;},on(name,fn){events.push(name);callbacks.set(name,fn);return name;}};
  globalThis.Actor=class{}; globalThis.Item=class{}; globalThis.Combat=class{};
  globalThis.ActorSheet=class{ activateListeners() {} }; globalThis.ItemSheet=class{};
  let selectedAbility;
  globalThis.Dialog=class{ static async prompt() { return selectedAbility; } };
  globalThis.Actors={unregisterSheet(){},registerSheet(){}};
  globalThis.Items={unregisterSheet(){},registerSheet(){}};
  globalThis.Handlebars={registerHelper(){}};
  class TestField { constructor(definition) { this.definition = definition; } }
  globalThis.foundry={abstract:{TypeDataModel:class{}},data:{fields:new Proxy({},{get:()=>TestField})},utils:{deepClone:structuredClone},applications:{handlebars:{loadTemplates:async paths=>{events.push(['templates',paths.length]);}}}};
  globalThis.CONFIG={Actor:{},Item:{},Combat:{}};
  const settings=new Map();
  globalThis.game={release:{generation:13},settings:{settings,register(ns,key,definition){settings.set(ns+'.'+key,definition);},get(ns,key){return settings.get(ns+'.'+key)?.default;}},user:{isGM:true}};
  await import('../dbu-old.mjs');
  await hooks.get('init')();
  assert.equal(CONFIG.DBU.rulesVersion,'0.9.3');
  assert.equal(CONFIG.DBU.talentsCatalog.length,275);
  const { talentCategories, talentsCatalog } = CONFIG.DBU;
  assert.equal(Object.keys(talentCategories).length, 33);
  assert.deepEqual(
    Object.values(talentCategories).flat().sort(),
    talentsCatalog.map(talent => talent.id).sort(),
  );
  for (const [name, category] of [
    ['Artful Strike', 'Attacking'],
    ['Wild Counter', 'Counter'],
    ['Angry Warrior', 'Raging'],
  ]) {
    const talent = talentsCatalog.find(entry => entry.name === name);
    assert.equal(talent.category, category);
    assert.ok(talentCategories[category].includes(talent.id));
  }
  assert.equal(Object.keys(CONFIG.DBU.transformationsCatalog).length,464);
  assert.equal(CONFIG.DBU.profileKpCosts.Beam,8);
  assert.equal(CONFIG.DBU.racialSkillRanks.yardrat,3);
  assert.equal(CONFIG.Actor.documentClass.name,'DBUActor');
  assert.equal(typeof CONFIG.Actor.dataModels.character.defineSchema,'function');
  assert.equal(typeof game.dbu.exportRulesBackup,'function');
  assert.ok(settings.has('DBU-MRR-OLD.rules093Migration'));
  assert.ok(hooks.has('ready')); assert.ok(events.includes('preCreateActor'));
  const updates=[];
  const actor={type:'character',updateSource:changes=>updates.push(changes)};
  callbacks.get('preCreateActor')(actor,{type:'character',name:'Imported',system:{race:'saiyan',racialTraits:['908d85ede236e3ce']}});
  assert.equal(updates[0].system.rulesVersion,'0.9.3');
  assert.equal(updates[0]['flags.DBU-MRR-OLD.rules093ImportedOriginal'].system.racialTraits[0],'908d85ede236e3ce');
  assert.ok(CONFIG.Actor.dataModels.character.defineSchema().rules093State);
  assert.ok(CONFIG.Item.dataModels.technique.defineSchema().superProfile);
  assert.ok(events.some(e=>Array.isArray(e)&&e[0]==='templates'&&e[1]>=24));

  const CharacterModel = CONFIG.Actor.dataModels.character;
  const initial = schema => Object.fromEntries(Object.entries(schema).map(([key, {definition}]) => {
    if (definition instanceof TestField) return [key, []];
    if (!definition) return [key, undefined];
    if (Object.hasOwn(definition, 'initial')) return [key, structuredClone(definition.initial)];
    if (Object.values(definition).every(field => field instanceof TestField)) return [key, initial(definition)];
    return [key, undefined];
  }));

  await t.test('selected racial bonuses reach derived attributes, rolls, resources and defenses and clear on removal', () => {
    const system = Object.assign(new CharacterModel(), initial(CharacterModel.defineSchema()), {
      level: 5, race: 'bioAndroid', rulesVersion: '0.9.3',
    });
    const actor = Object.assign(new CONFIG.Actor.documentClass(), { system, items: [] });
    system.attributes.te.racial = 3;
    system.lifePoints.value = 110;
    system.damageCalc.woundRoll = 30;
    const stats = () => {
      system.prepareDerivedData();
      actor._prepareCharacterData(system);
      return {
        insight: system.attributes.in.totalScore, insightScore: system.attributes.in.score,
        cognitive: system.savingThrows.cognitive.bonus, awareness: system.aptitudes.awareness,
        life: system.lifePoints.max, soak: system.status.soak, dr: system.status.damageReduction,
        damage: system.damageCalc.healthReduction,
        surgency: system.status.surgency, healing: system.status.healingSurge, ki: system.status.powerSurgeKi,
        normalSpeed: system.status.normalSpeed, boostedSpeed: system.status.boostedSpeed,
        dodge: system.aptitudes.dodgeBuffTotal,
      };
    };
    const baseline = stats();
    const psychic = 'r093_mutation_psychic';
    const design = 'r093_bio_android_defensive_design';
    const armor = 'r093_cybernetic_enhancement_armor_plating';
    const life = 'r093_cybernetic_enhancement_life_support';
    const warrior = 'r093_bio_android_artificial_warrior';
    system.racialTraits = [psychic, design, armor, life, warrior, psychic];
    system.racialOptionSelections = { [warrior]: { 4: 'Genetic Agility' } };
    const withPassives = stats();
    assert.deepEqual(withPassives, {
      insight: baseline.insight + 2, insightScore: baseline.insightScore,
      cognitive: baseline.cognitive + 2, awareness: baseline.awareness + 2,
      life: baseline.life + 5 * 6, soak: baseline.soak + 2, dr: baseline.dr + 4, damage: baseline.damage - 6,
      surgency: baseline.surgency + 4, healing: `4d10+${baseline.surgency + 4}`, ki: baseline.ki + 4,
      normalSpeed: baseline.normalSpeed + 2, boostedSpeed: baseline.boostedSpeed + 2,
      dodge: baseline.dodge + 2,
    });
    assert.deepEqual(stats(), withPassives);
    system.racialOptionSelections[warrior][4] = 'Genetic Survivor';
    system.effectTracking = { enabledPassives: { 'racial_secondary_defensive_design_2': false } };
    const survivor = stats();
    assert.equal(survivor.life, withPassives.life + 10);
    assert.equal(survivor.soak, withPassives.soak + 2);
    assert.equal(survivor.dr, withPassives.dr - 2);
    assert.equal(survivor.normalSpeed, baseline.normalSpeed);
    assert.equal(survivor.boostedSpeed, baseline.boostedSpeed);
    assert.equal(survivor.dodge, baseline.dodge);
    system.racialTraits = [];
    assert.deepEqual(stats(), baseline);
  });

  await t.test('Demon Actor prepares one set of modifiers, with final LP, Prone, Soak and Broken', () => {
    const system = Object.assign(new CharacterModel(), initial(CharacterModel.defineSchema()), {
      level: 5, race: 'demon', subrace: 'phantom', rulesVersion: '0.9.3',
      racialTraits: ['r093_demons_demonic_pressure', 'r093_demons_demonic_resilience', 'r093_demons_fallen_idol'],
      rules093State: { racialResources: {} },
    });
    const actor = Object.assign(new CONFIG.Actor.documentClass(), { system, items: [] });
    system.attributes.ag.racial = 9;
    system.attributes.te.racial = 5;
    system.damageCalc.woundRoll = 30;
    system.lifePoints.value = 100;
    system.adversary.enabled = true;
    system.adversary.category = 'villain';
    const stats = () => { system.prepareDerivedData(); actor._prepareCharacterData(system); };
    stats();
    const { damageReduction: dr, soak, might } = system.status;
    const { defenseValue: defense, woundBuffTotal: wound } = system.aptitudes;
    const score = system.attributes.fo.score, save = system.savingThrows.cognitive.bonus;
    system.lifePoints.value = Math.floor(system.lifePoints.max / 4);
    Object.assign(system.rules093State.racialResources, { demonicPower: 2, demonicFatigue: 1, resilienceActive: true });
    system.conditions = [{ id: 'prone', active: true, stacks: 1 }];
    stats();
    assert.equal(system.savingThrows.cognitive.bonus, save + 2);
    assert.equal(system.status.damageReduction, dr + 4);
    assert.equal(system.status.soak, soak + 2);
    assert.equal(system.status.might, might + 2);
    assert.equal(system.attributes.fo.score, score);
    assert.equal(system.aptitudes.defenseValue, Math.floor((defense - 2) / 2));
    assert.equal(system.aptitudes.woundBuffTotal, wound + 8 - system.thresholds.penalties);
    system.lifePoints.value++;
    system.rules093State.racialResources.demonicFatigue = 40;
    system.conditions = [{ id: 'broken', active: true, stacks: 3 }];
    stats();
    assert.equal(system.savingThrows.cognitive.bonus, save);
    assert.equal(system.status.soak, 2);
    assert.equal(system.status.brokenOverflow093, 10);
    assert.equal(system.damageCalc.healthReduction, 30 - 2 - system.status.damageReduction + 10);
    system.rules093State.racialResources.resilienceSuccesses = 2;
    stats();
    assert.equal(system.status.damageReduction, dr + 8);
    assert.equal(system.damageCalc.healthReduction, 30 - 2 - (dr + 8) + 10);
    assert.equal(system.status.brokenOverflow093, 10);
    stats();
    assert.equal(system.status.damageReduction, dr + 8);
    system.rules093State.racialResources = {};
    system.conditions = [];
    stats();
    assert.equal(system.status.soak, soak);
    assert.equal(system.status.damageReduction, dr);
    assert.equal(system.damageCalc.healthReduction, 30 - soak - dr);
    const baseLife = system.lifePoints.max;
    const baseSurgency = system.status.surgency;
    const factorCases = [
      ['r093_megath_colossal_demon', 4 * system.level, 0, 0],
      ['r093_monster_custom_monstrosity', 2 * system.level, 0, 0],
      ['r093_monster_genie', 0, Math.floor(system.attributes.in.totalScore / 2), 0],
      ['r093_monster_mummy', 0, 2 * system.baseTier, 2 * system.baseTier],
    ];
    for (const [id, lifeGain, extraDR, recovery] of factorCases) {
      system.racialTraits = [id];
      stats();
      assert.equal(system.lifePoints.max, baseLife + lifeGain, id);
      assert.equal(system.status.damageReduction, dr + extraDR, id);
      assert.equal(system.status.surgency, baseSurgency + recovery, id);
    }
  });

  await t.test('unique abilities can be added without a type and a dual type can be changed or cleared', async () => {
    const schema = CONFIG.Actor.dataModels.character.defineSchema();
    const abilityType = schema.uniqueAbilities.definition.definition.abilityType.definition;
    const character = {
      system: { rulesVersion: '0.9.3', uniqueAbilities: [] },
      async update(changes) {
        this.system.uniqueAbilities = changes['system.uniqueAbilities'].map(row => {
          const value = row.abilityType ?? abilityType.initial;
          assert.ok(value !== '' || abilityType.blank, 'the default type must allow an empty string');
          assert.ok(abilityType.choices.includes(value));
          return { ...row, abilityType: value };
        });
      },
    };
    const { DBUCharacterSheet } = await import('../module/sheets/character-sheet.mjs');
    const sheet = Object.assign(new DBUCharacterSheet(), {
      actor: character, isEditable: true, _populateTrackerSources() {},
    });
    const handlers = new Map();
    sheet.activateListeners({ on: (_event, selector, callback) => handlers.set(selector, callback) });
    const add = handlers.get("[data-action='add-unique']");
    for (const key of ['barrier', 'shapeshift']) {
      selectedAbility = key;
      await add({ preventDefault() {} });
    }
    assert.deepEqual(character.system.uniqueAbilities.map(row => [row.abilityKey, row.abilityType]), [
      ['barrier', ''], ['shapeshift', ''],
    ]);
    const change = handlers.get('[data-dbu-unique-type]');
    for (const value of ['Technical', 'Magical', '']) {
      await change({ currentTarget: { value, dataset: { dbuUniqueType: '0' } } });
      assert.equal(character.system.uniqueAbilities[0].abilityType, value);
    }
    for (const ability of Object.values(CONFIG.DBU.uniqueAbilitiesCatalog).filter(row => !row.legacy)) {
      selectedAbility = ability.id;
      await add({ preventDefault() {} });
      assert.ok(character.system.uniqueAbilities.some(row => row.abilityKey === ability.id), ability.name);
    }
    assert.equal(character.system.uniqueAbilities.length, 66);
    assert.ok(character.system.uniqueAbilities.some(row => row.abilityKey === 'position_change'));
  });
});
