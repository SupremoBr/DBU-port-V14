import test from 'node:test';
import assert from 'node:assert/strict';
const path = new URL('../module/helpers/foundry-compat.mjs', import.meta.url).href;

test('modern APIs work without legacy globals', async () => {
  class ActorSheet {}
  class ItemSheet {}
  class Dialog {
    constructor(data, options) { Object.assign(this, { data, options }); }
    static wait(data, options, renderOptions) { return { data, options, renderOptions }; }
    static prompt(data) { return data; }
    static confirm(data) { return data; }
  }
  const editor = {};
  globalThis.foundry = { appv1: { sheets: { ActorSheet, ItemSheet }, api: { Dialog } }, applications: { ux: { TextEditor: { implementation: editor } } } };
  const api = await import(path + '?modern');
  assert.equal(api.ActorSheet, ActorSheet);
  assert.equal(api.ItemSheet, ItemSheet);
  const data = { title: 'Escolher', callback() {} };
  const options = { width: 500, classes: ['custom-dialog', 'dialog'] };
  const styled = { width: 500, classes: ['dialog', 'dbua-system-dialog', 'custom-dialog'] };
  assert.ok(new api.Dialog(data, options) instanceof Dialog);
  assert.deepEqual(new api.Dialog(data, options).options, styled);
  assert.deepEqual(api.Dialog.wait(data, options, { focus: true }), { data, options: styled, renderOptions: { focus: true } });
  assert.deepEqual(api.Dialog.prompt({ ...data, options }), { ...data, options: styled });
  assert.deepEqual(api.Dialog.confirm({ ...data, options }), { ...data, options: styled });
  assert.deepEqual(options.classes, ['custom-dialog', 'dialog']);
  assert.equal(api.TextEditor, editor);
});

test('v12 aliases and template loader are preserved', async () => {
  delete globalThis.foundry;
  globalThis.ActorSheet = class {};
  globalThis.ItemSheet = class {};
  globalThis.Dialog = class {};
  globalThis.TextEditor = {};
  globalThis.loadTemplates = async paths => paths;
  const api = await import(path + '?legacy');
  assert.equal(api.ActorSheet, globalThis.ActorSheet);
  assert.equal(api.ItemSheet, globalThis.ItemSheet);
  assert.ok(new api.Dialog() instanceof globalThis.Dialog);
  assert.equal(api.TextEditor, globalThis.TextEditor);
  assert.deepEqual(await api.loadSystemTemplates(['a.hbs']), ['a.hbs']);
});

test('modern template loader propagates failure without legacy fallback', async () => {
  const failure = new Error('missing template');
  globalThis.foundry = { applications: { handlebars: { loadTemplates: async () => { throw failure; } } } };
  const api = await import(path + '?templates');
  await assert.rejects(api.loadSystemTemplates(['missing.hbs']), e => e === failure);
});

test('chat registers exactly one hook for each supported generation', async () => {
  const api = await import(path + '?hooks');
  const calls = [];
  globalThis.Hooks = { on: (...args) => calls.push(args) };
  const callback = () => {};
  for (const generation of [12, 13, 14]) {
    globalThis.game = { release: { generation } };
    api.onRenderChatMessage(callback);
  }
  assert.deepEqual(calls.map(c => c[0]), ['renderChatMessage', 'renderChatMessageHTML', 'renderChatMessageHTML']);
  assert.ok(calls.every(c => c[1] === callback));
});

test('modern sheet registry receives document classes and sheet types', async () => {
  const registered = [], removed = [];
  class Actor {}
  class Item {}
  class ActorSheetV2 {}
  class ItemSheetV2 {}
  globalThis.foundry = { documents: { Actor, Item }, applications: { sheets: { ActorSheetV2, ItemSheetV2 }, apps: { DocumentSheetConfig: {
    registerSheet: (...args) => registered.push(args), unregisterSheet: (...args) => removed.push(args)
  } } } };
  const api = await import(path + '?registry');
  class Character {}
  class Jacket {}
  class ItemSheet {}
  api.registerSystemSheets(Character, Jacket, ItemSheet);
  assert.deepEqual(removed, [[Actor, 'core', ActorSheetV2], [Item, 'core', ItemSheetV2]]);
  assert.equal(registered.length, 3);
  assert.deepEqual(registered.map(c => [c[0], c[2], c[3].types]), [[Actor, Character, ['character']], [Actor, Jacket, ['battleJacket']], [Item, ItemSheet, undefined]]);
  assert.ok(registered.every(c => c[1] === 'DBU-MRR-OLD' && c[3].makeDefault));
});

test('legacy sheet registry registers all three sheets', async () => {
  delete globalThis.foundry;
  const registered = [], removed = [];
  globalThis.Actors = { registerSheet: (...a) => registered.push(a), unregisterSheet: (...a) => removed.push(a) };
  globalThis.Items = globalThis.Actors;
  const api = await import(path + '?legacy-registry');
  api.registerSystemSheets('character', 'jacket', 'item');
  assert.equal(registered.length, 3);
  assert.equal(removed.length, 2);
  assert.deepEqual(registered.map(c => c[1]), ['character', 'jacket', 'item']);
});
