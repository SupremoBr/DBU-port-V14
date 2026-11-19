import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGS_093 } from '../module/rules/catalogs-v093.mjs';
import { convertActor093, convertItem093, migrateWorld093, SYSTEM_ID, MIGRATION_KEY, exportRulesBackup } from '../module/rules/migration-v093.mjs';
const clone = structuredClone;
const oldActor = () => ({ _id: 'a', name: 'Saiyan', type: 'character', flags: { other: { preserve: 17 } }, prototypeToken: { texture: { src: 'portrait.webp' } }, system: { race: 'saiyan', level: 1, baseTier: 1, racialTraits: ['908d85ede236e3ce','41c68475bc754d8d','removed-trait'], racialOptionSelections: { '41c68475bc754d8d': { '1': 'Tailless' } }, talents: ['focused_strike','gone-talent'], attributes: { fo: { racial: 2 }, te: { racial: 2 }, ag: { racial: 1 } }, signatureTechniques: [{ id: 1, name: 'Old Sphere', foundation: 'Energy', profile: 'Sphere' }], transformations: [{ id: 1, name: 'Lost Form', catalogKey: 'deleted', active: true, attrBonuses: { fo: '+99' } }], lifePoints: { value: 51 }, kiPool: { value: 37 } } });
function doc(source, uuid, events) {
  let data = clone(source);
  const d = { uuid, id: source._id, type: source.type, name: source.name, items: [], toObject: () => clone(data), getFlag: (ns, key) => data.flags?.[ns]?.[key], async update(changes) { events.push(['update', uuid]); data = { ...data, ...clone(changes) }; return d; } };
  Object.defineProperty(d, 'system', { get: () => data.system });
  return d;
}
function fixture() {
  const events = [], saved = new Map();
  const actor = doc(oldActor(), 'Actor.a', events);
  actor.items = [doc({ _id: 'owned', name: 'Beam', type: 'technique', system: { foundation: 'Energy', profile: 'Beam', advantages: [{ name: 'Power Shot', ranks: 2, tpCost: 999 }] } }, 'Actor.a.Item.owned', events)];
  const tokenActor = doc({ ...oldActor(), _id: 'synthetic' }, 'Scene.s.Token.t.Actor.a', events);
  const scene = doc({ _id: 's', name: 'Scene', tokens: [{ _id: 't', actorLink: false, delta: { system: { lifePoints: { value: 5 } } } }] }, 'Scene.s', events);
  scene.tokens = [{ actorLink: false, actor: tokenActor }];
  const item = doc({ _id: 'worldItem', name: 'Old Spell', type: 'technique', system: { foundation: 'Magic', profile: 'Spell' } }, 'Item.worldItem', events);
  const gm = { id: 'gm', isGM: true, active: true }; const users = [gm]; users.activeGM = gm;
  const game = { user: gm, users, actors: [actor], scenes: [scene], items: [item], combats: [], journal: new Map(), world: { id: 'test' }, system: { version: 'test' }, settings: { get: (ns,k) => clone(saved.get(k)), async set(ns,k,value) { events.push(['setting', k]); saved.set(k,clone(value)); } } };
  const Journal = { async create(source) { events.push(['backup']); const backup = doc({ ...source, _id: 'backup' }, 'JournalEntry.backup', events); game.journal.set('backup',backup); return backup; } };
  return { game, actor, tokenActor, scene, item, Journal, events, saved };
}

test('exact mapping moves Heritage option from 1 to 5, archives removals, and blocks unmatched active forms', () => {
  const source = oldActor(), before = clone(source);
  const result = convertActor093(source);
  assert.deepEqual(source,before);
  assert.equal(result.system.rulesVersion,'0.9.3');
  assert.equal(result.system.racialTraits.includes('removed-trait'),false);
  const heritage = CATALOGS_093.racialTraits.saiyan.find(t => t.name === 'Saiyan Heritage');
  assert.deepEqual(result.system.racialOptionSelections[heritage.id], { '5': 'Tailless' });
  assert.equal(result.system.transformations[0].active,false);
  assert.deepEqual(result.system.transformations[0].attrBonuses,{});
  assert.ok(result.issues.some(i => i.previous?.attrBonuses?.fo === '+99'));
  assert.equal(result.system.lifePoints.value,51);
  assert.equal(result.system.kiPool.value,37);
  assert.equal(convertActor093({system:result.system}),null);
});
test('owned and standalone technique conversion reprices ranks without inventing removed profiles', () => {
  const plan = convertItem093({ name:'Beam',type:'technique', system:{ foundation:'Energy',profile:'Beam', advantages:[{name:'Power Shot',ranks:2,tpCost:999}] } });
  assert.equal(plan.system.advantages[0].tpCost,10);
  assert.deepEqual(plan.issues,[]);
  const removed = convertItem093({name:'Spell',type:'technique',system:{foundation:'Magic',profile:'Spell'}});
  assert.equal(removed.system.profile,'Spell');
  assert.match(removed.issues[0].reason,/removido/);
});
test('a persisted backup precedes all updates and includes prototype and token delta data', async () => {
  const f = fixture();
  const state = await migrateWorld093(f.game,{Journal:f.Journal});
  assert.equal(f.events[0][0],'backup');
  assert.equal(f.events[1][0],'setting');
  assert.equal(state.complete,true);
  const backup = f.game.journal.get('backup').getFlag(SYSTEM_ID,'rules093Backup');
  assert.equal(backup.documents.actors[0].system.rulesVersion,undefined);
  assert.equal(backup.documents.actors[0].prototypeToken.texture.src,'portrait.webp');
  assert.equal(backup.documents.scenes[0].tokens[0].delta.system.lifePoints.value,5);
  assert.equal(f.actor.system.rulesVersion,'0.9.3');
  assert.equal(f.tokenActor.system.rulesVersion,'0.9.3');
  assert.equal(f.actor.toObject().flags.other.preserve,17);
  assert.equal(f.actor.items[0].system.advantages[0].tpCost,10);
  assert.ok(f.item.getFlag(SYSTEM_ID,'rules093Review').issues.length);
  const count = f.events.length;
  await migrateWorld093(f.game,{Journal:f.Journal});
  assert.equal(f.events.length,count);
  let downloaded;
  globalThis.saveDataToFile = (text,kind,name) => { downloaded={text,kind,name}; };
  exportRulesBackup(f.game);
  assert.equal(downloaded.name,'test-before-093.json');
  assert.equal(JSON.parse(downloaded.text).documents.actors[0].system.lifePoints.value,51);
});
test('failed backup and missing original backup prevent any world mutation', async () => {
  const f = fixture();
  await assert.rejects(migrateWorld093(f.game,{Journal:{create:async()=>{throw new Error('disk');}}}),/disk/);
  assert.deepEqual(f.events,[]);
  f.saved.set(MIGRATION_KEY,{backupId:'missing',complete:false});
  await assert.rejects(migrateWorld093(f.game,{Journal:f.Journal}),/Backup/);
  assert.deepEqual(f.events,[]);
});
test('interrupted conversions resume from the same backup and never reprocess completed documents', async () => {
  const f = fixture();
  const original = f.tokenActor.update;
  f.tokenActor.update = async () => { throw new Error('interrupted'); };
  await assert.rejects(migrateWorld093(f.game,{Journal:f.Journal}),/interrupted/);
  assert.equal(f.saved.get(MIGRATION_KEY).complete,false);
  const updates = f.events.filter(e=>e[0]==='update' && e[1]==='Actor.a').length;
  f.tokenActor.update=original;
  await migrateWorld093(f.game,{Journal:f.Journal});
  assert.equal(f.events.filter(e=>e[0]==='backup').length,1);
  assert.equal(f.events.filter(e=>e[0]==='update' && e[1]==='Actor.a').length,updates);
  assert.equal(f.saved.get(MIGRATION_KEY).complete,true);
});
test('only the active primary GM may run the migration', async () => {
  const f = fixture(); f.game.user={id:'player',isGM:false};
  assert.equal((await migrateWorld093(f.game,{Journal:f.Journal})).skipped,'primary-gm');
  assert.deepEqual(f.events,[]);
});

test('standalone racial Items honor the explicit Born for Battle rename',()=>{
  const result=convertItem093({type:'racialTrait',name:'Battle Born',system:{race:'saiyan',description:'Old text'}});
  assert.equal(result.name,'Born for Battle');
  assert.equal(result.system.effects.length,4);
  assert.match(result.system.description,/0.9.3/);
});
