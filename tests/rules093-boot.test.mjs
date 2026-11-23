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
  });
});
