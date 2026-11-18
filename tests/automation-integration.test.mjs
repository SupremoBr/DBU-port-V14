import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { SYSTEM_ID, AUTOMATION_SOCKET, activeLegacyModules, getAutomationPackage, readAutomationFlag, chatRenderHook, onAutomationChatRender } from '../module/automation/package.mjs';
import { createAutomationLifecycle, ENABLED_SETTING } from '../module/automation/lifecycle.mjs';
import { legacyFlagUpdates, automationDocuments, migrateLegacyAutomation, migrateAutomationSettings, unsetAutomationFlag } from '../module/automation/migration.mjs';
import { automationEnvironment, documentWithFlags, Collection } from './helpers/automation-environment.mjs';

test('embedded identity uses a real system package/socket and preserves Foundry 13', () => {
  const { game } = automationEnvironment();
  assert.equal(AUTOMATION_SOCKET, 'system.DBU-MRR-OLD');
  assert.equal(getAutomationPackage(game).embedded, true);
  assert.equal(getAutomationPackage(game).active, true);
  assert.equal(chatRenderHook(game), 'renderChatMessageHTML');
  assert.equal(chatRenderHook({ release: { generation: 12 } }), 'renderChatMessage');
  assert.equal(chatRenderHook({ release: { generation: 14 } }), 'renderChatMessageHTML');
});

test('system manifest includes the embedded entry, socket, styles and language without dropping v13', () => {
  const manifest = JSON.parse(readFileSync(new URL('../system.json', import.meta.url)));
  assert.ok(Number(manifest.compatibility.minimum) <= 13);
  assert.ok(Number(manifest.compatibility.maximum) >= 13);
  assert.equal(manifest.compatibility.verified, '13');
  assert.equal(manifest.socket, true);
  assert.ok(manifest.esmodules.includes('module/automation/entry.mjs'));
  for (const p of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(l => l.path)]) assert.ok(existsSync(new URL('../' + p, import.meta.url)), p);
});

test('all three legacy automation packages prevent loading embedded code', async () => {
  for (const id of ['dbu-automation-dev', 'dbu-automation', 'dbu-auto-start']) {
    const { game } = automationEnvironment(); game.modules.set(id, { active: true });
    let loads = 0, migrations = 0;
    const life = createAutomationLifecycle({ getGame: () => game, load: async () => { loads++; }, migrate: async () => { migrations++; } });
    const status = await life.ready();
    assert.equal(status.mode, 'external-module');
    assert.deepEqual(activeLegacyModules(game), [id]);
    assert.equal(loads, 0); assert.equal(migrations, 0);
  }
});

test('explicit opt-out and other systems install no embedded hooks or API', async () => {
  const { game, storage } = automationEnvironment(); let loads = 0;
  storage.get('world').set(`${SYSTEM_ID}.${ENABLED_SETTING}`, { value: false });
  const life = createAutomationLifecycle({ getGame: () => game, load: async () => { loads++; } });
  assert.equal((await life.ready()).mode, 'disabled');
  game.system.id = 'other';
  const other = createAutomationLifecycle({ getGame: () => game, load: async () => { loads++; } });
  assert.equal((await other.ready()).mode, 'inactive'); assert.equal(loads, 0);
});

test('ready waits for preparation and migration and starts only once', async () => {
  const { game } = automationEnvironment(); const events = [], api = {};
  let resolveLoad;
  const deferred = new Promise(resolve => { resolveLoad = resolve; });
  const life = createAutomationLifecycle({
    getGame: () => game, getAPI: () => api,
    load: async () => { events.push('load'); return deferred; },
    migrate: async () => { events.push('migrate'); return { settings: 0, documents: 0 }; }
  });
  const a = life.prepare(), b = life.ready();
  await Promise.resolve(); assert.deepEqual(events, ['load']); assert.equal(life.status.ready, false);
  resolveLoad({ boot: async () => { events.push('boot'); api.coreReady = true; } });
  await a; await b; await life.prepare(); await life.ready();
  assert.deepEqual(events, ['load', 'migrate', 'boot']); assert.equal(game.dbu.automation, api);
});

test('preparation and incomplete boot failures never report ready', async () => {
  const { game } = automationEnvironment();
  const badLoad = createAutomationLifecycle({ getGame: () => game, load: async () => { throw Error('load failure'); } });
  await assert.rejects(badLoad.ready(), /load failure/); assert.equal(badLoad.status.ready, false);
  const badBoot = createAutomationLifecycle({ getGame: () => game, load: async () => ({ boot: async () => {} }), migrate: async () => ({}), getAPI: () => ({ coreReady: false }) });
  await assert.rejects(badBoot.ready(), /inicialização incompleta/); assert.equal(badBoot.status.ready, false);
});

test('legacy reads honor dev/stable precedence and explicit current false/null values', () => {
  const doc = { flags: { 'dbu-automation-dev': { visualConfig: { mode: 'dev' }, nested: { value: 4 } }, 'dbu-automation': { visualConfig: { mode: 'stable' } } } };
  assert.deepEqual(readAutomationFlag(doc, 'visualConfig'), { mode: 'dev' });
  assert.equal(readAutomationFlag(doc, 'nested.value'), 4);
  doc.flags[SYSTEM_ID] = { visualConfig: false, nested: { value: null } };
  assert.equal(readAutomationFlag(doc, 'visualConfig'), false);
  assert.equal(readAutomationFlag(doc, 'nested.value'), null);
  assert.equal(readAutomationFlag(null, 'unknown'), undefined);
});

test('flag migration preserves current fields, old data and original token snapshots; reruns do nothing', async () => {
  const doc = documentWithFlags({
    [SYSTEM_ID]: { visualConfig: { token: 'current.webp' }, nativeValue: 3 },
    'dbu-automation-dev': { visualConfig: { token: 'old.webp', aura: 'aura.webm' }, transformationBaseToken: { texture: { src: 'base.webp' }, tokens: [{ id: 'unlinked' }] } },
    'dbu-automation': { visualConfig: { aura: 'stable.webm' } }
  });
  const old = structuredClone(doc.flags['dbu-automation-dev']);
  await doc.update(legacyFlagUpdates(doc.flags));
  assert.equal(doc.flags[SYSTEM_ID].visualConfig.token, 'current.webp');
  assert.equal(doc.flags[SYSTEM_ID].visualConfig.aura, 'aura.webm');
  assert.deepEqual(doc.flags[SYSTEM_ID].transformationBaseToken, old.transformationBaseToken);
  assert.equal(doc.flags[SYSTEM_ID].nativeValue, 3);
  assert.deepEqual(doc.flags['dbu-automation-dev'], old);
  assert.deepEqual(legacyFlagUpdates(doc.flags), {});
});

test('cleared flags are not resurrected from preserved legacy copies, even before GM migration', async () => {
  const doc = documentWithFlags({ 'dbu-automation-dev': { transformationLastVisual: { image: 'old.webp' }, transformationBaseToken: { image: 'base.webp' } } });
  assert.deepEqual(readAutomationFlag(doc, 'transformationLastVisual'), { image: 'old.webp' });
  await unsetAutomationFlag(doc, SYSTEM_ID, 'transformationLastVisual');
  assert.equal(readAutomationFlag(doc, 'transformationLastVisual'), undefined);
  assert.deepEqual(readAutomationFlag(doc, 'transformationBaseToken'), { image: 'base.webp' });
  assert.ok(doc.flags['dbu-automation-dev'].transformationLastVisual);
  assert.deepEqual(legacyFlagUpdates(doc.flags), {});
  const worldDoc = documentWithFlags({ world: { other: true } });
  await unsetAutomationFlag(worldDoc, 'world', 'other');
  assert.equal(worldDoc.updates.length, 0);
  assert.equal(worldDoc.flags.world.other, undefined);
});

test('settings migration handles client/world serialized values without overwriting configured targets', async () => {
  const { game, registered, storage } = automationEnvironment();
  for (const [key, scope] of [['hud', 'client'], ['prefs', 'client'], ['worldSetting', 'world']]) registered.set(`${SYSTEM_ID}.${key}`, { scope });
  storage.get('client').set('dbu-automation-dev.hud', { value: 'false' });
  storage.get('client').set('dbu-automation-dev.prefs', { value: '{"x":3}' });
  storage.get('world').set('dbu-automation.worldSetting', { value: '4' });
  storage.get('client').set(`${SYSTEM_ID}.prefs`, { value: { x: 99 } });
  assert.equal(await migrateAutomationSettings(game), 2);
  assert.equal(storage.get('client').get(`${SYSTEM_ID}.hud`).value, false);
  assert.deepEqual(storage.get('client').get(`${SYSTEM_ID}.prefs`).value, { x: 99 });
  assert.equal(storage.get('world').get(`${SYSTEM_ID}.worldSetting`).value, 4);
  assert.equal(await migrateAutomationSettings(game), 0);
  assert.ok(storage.get('client').has('dbu-automation-dev.hud'));
});

test('client preferences migrate through Storage.getItem while players never write world settings', async () => {
  const { game, registered, storage } = automationEnvironment({ isGM: false });
  const local = new Map([['dbu-automation-dev.pref', '{"anchor":"top-right"}']]);
  storage.set('client', { getItem: key => local.get(key) ?? null });
  registered.set(`${SYSTEM_ID}.pref`, { scope: 'client' });
  registered.set(`${SYSTEM_ID}.worldSetting`, { scope: 'world' });
  storage.get('world').set('dbu-automation-dev.worldSetting', { value: 'true' });
  const writes = [];
  game.settings.set = async (scope, key, value) => { writes.push([scope, key, value]); local.set(`${scope}.${key}`, JSON.stringify(value)); };
  assert.equal(await migrateAutomationSettings(game), 1);
  assert.deepEqual(writes, [[SYSTEM_ID, 'pref', { anchor: 'top-right' }]]);
  assert.equal(await migrateAutomationSettings(game), 0);
});

test('document migration covers linked prototypes, unlinked synthetic actors and combatants only on primary GM', async () => {
  const { game } = automationEnvironment();
  const make = () => documentWithFlags({ 'dbu-automation-dev': { visualConfig: { token: 'base.webp' } } });
  const actor = make(), prototype = make(), token = make(), synthetic = make(), scene = make(), combatant = make(), combat = make();
  actor.prototypeToken = prototype; actor.items = new Collection();
  token.actorLink = false; token.actor = synthetic; scene.tokens = new Collection([['token', token]]);
  combat.combatants = new Collection([['combatant', combatant]]);
  game.actors.set('actor', actor); game.scenes.set('scene', scene); game.combats.set('combat', combat);
  assert.equal(automationDocuments(game).length, 7);
  assert.equal((await migrateLegacyAutomation(game)).documents, 7);
  assert.equal((await migrateLegacyAutomation(game)).documents, 0);
  assert.ok(synthetic.flags[SYSTEM_ID].visualConfig);
  game.user.isGM = false;
  actor.flags = { 'dbu-automation-dev': { other: true } };
  assert.equal((await migrateLegacyAutomation(game)).documents, 0);
  game.user.isGM = true; game.users.activeGM = { id: 'other-gm' };
  assert.equal((await migrateLegacyAutomation(game)).documents, 0);
});

test('modern chat hook adapts HTMLElement to jQuery exactly once and preserves the callback result', () => {
  const env = automationEnvironment(); env.install();
  globalThis.HTMLElement = class {};
  const element = new HTMLElement(), wrapped = { 0: element };
  globalThis.$ = html => { assert.equal(html, element); return wrapped; };
  const id = onAutomationChatRender((message, html) => { assert.equal(message.id, 'm'); assert.equal(html, wrapped); return 7; });
  assert.equal(env.hooks.get(id).event, 'renderChatMessageHTML');
  assert.equal(env.hooks.get(id).fn({ id: 'm' }, element), 7);
});

test('late preparation rebuilds GM scene controls once after the automation is available', async () => {
  const env = automationEnvironment(); env.install(); canvas.ready = true;
  let rebuilt = 0; ui.controls.initialize = async options => { assert.deepEqual(options, {}); rebuilt++; };
  const life = createAutomationLifecycle({ load: async () => ({ boot: async () => {} }), migrate: async () => ({}), getAPI: () => ({ coreReady: true }) });
  await life.ready(); await life.ready(); assert.equal(rebuilt, 1);
});

test('integrated Ki/Capacity payment rejects unaffordable actions and commits successful payment once', async () => {
  const env = automationEnvironment(); env.install();
  const { dbuPayKiAndCapacity } = await import('../module/automation/scripts/core/resources.js');
  const actor = { name: 'Actor', system: { kiPool: { value: 10 }, status: { maxCapacity: 8, capacitySpent: 2 } }, updates: [] };
  actor.update = async changes => { actor.updates.push(changes); actor.system.kiPool.value = changes['system.kiPool.value']; actor.system.status.capacitySpent = changes['system.status.capacitySpent']; };
  assert.equal((await dbuPayKiAndCapacity(actor, 9)).reason, 'capacity');
  assert.equal(actor.updates.length, 0);
  assert.equal((await dbuPayKiAndCapacity(actor, 3)).ok, true);
  assert.equal(actor.updates.length, 1);
  assert.equal(actor.system.kiPool.value, 7);
  assert.equal(actor.system.status.capacitySpent, 5);
});

test('real embedded graph boots on a Foundry 13 stub with settings, API, UI hooks and system sockets', async () => {
  const env = automationEnvironment(); env.install();
  const life = createAutomationLifecycle();
  await life.prepare(); env.game.ready = true;
  const status = await life.ready();
  assert.equal(status.ready, true); assert.equal(status.mode, 'integrated');
  assert.equal(globalThis.DBUAutomation.version, '1.9.22');
  for (const key of ['attack', 'aura', 'transform', 'energyCharge', 'hud', 'gmPanel', 'visualConfig', 'resolveAreaTargets']) assert.equal(typeof game.dbu.automation[key], 'function', key);
  assert.ok(env.registered.has(`${SYSTEM_ID}.combatHudEnabled`));
  assert.ok(env.registered.has(`${SYSTEM_ID}.combatHudFavoriteActions`));
  assert.ok(env.hooks.size > 0); assert.ok(env.channels.length > 0);
  assert.ok(env.channels.every(entry => entry.channel === AUTOMATION_SOCKET));
  assert.ok([...env.hooks.values()].some(entry => entry.event === 'renderChatMessageHTML'));
  assert.ok([...env.hooks.values()].every(entry => entry.event !== 'renderChatMessage'));
  assert.ok(env.elements.has('dbu-combat-hud-launcher'));
  const before = [env.hooks.size, env.channels.length]; await life.ready(); await life.prepare();
  assert.deepEqual([env.hooks.size, env.channels.length], before);
  assert.equal(env.notices.filter(n => n.type === 'error').length, 0);
});
