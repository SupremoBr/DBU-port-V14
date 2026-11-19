import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGS_093 } from '../module/rules/catalogs-v093.mjs';

let dialog;
let action;
globalThis.Dialog = {
  async wait(options) {
    dialog = options;
    return options.buttons[action].callback({
      find: () => ({ val: () => 'Minha descrição\nSegunda linha' }),
    });
  },
};
globalThis.foundry = {
  utils: {
    escapeHTML: text => text.replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
  },
};
const { applyCatalogDescriptions, editCatalogDescription } = await import('../module/rules/catalog-descriptions.mjs');

test('all catalog entries have their own summary and official source', () => {
  for (const entries of [Object.values(CATALOGS_093.racialTraits).flat(), CATALOGS_093.talents]) {
    assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
    for (const entry of entries) {
      assert.ok(entry.description.trim(), entry.name);
      assert.equal(new URL(entry.source).hostname, 'dbu-rpg.com', entry.name);
    }
  }
});

test('the editor saves and restores an individual entry without modifying the catalog', async () => {
  const entry = { id: 'test_trait', name: 'Test', description: 'Original <text>', effects: [{ level: 1 }] };
  const sibling = { id: 'other_trait', description: 'Other entry' };
  const flags = { traits: { other_trait: 'Custom sibling' }, talents: { test_trait: 'Custom talent' } };
  const writes = [];
  const actor = {
    system: { racialTraits: [entry.id] },
    getFlag: () => flags,
    update: async changes => writes.push(changes),
  };
  const sheet = {
    actor,
    isEditable: true,
    _getCharacterTraits: () => applyCatalogDescriptions(actor, 'traits', [entry, sibling]),
  };

  action = 'save';
  await editCatalogDescription(sheet, 'traits', entry.id);
  assert.match(dialog.content, /Original &lt;text&gt;/);
  assert.equal(dialog.buttons.restore, undefined);
  assert.deepEqual(writes.at(-1), {
    'flags.DBU-MRR-OLD.catalogDescriptions.traits.test_trait': 'Minha descrição\nSegunda linha',
  });

  flags.traits.test_trait = 'Minha descrição\nSegunda linha';
  assert.equal(sheet._getCharacterTraits()[1].description, 'Custom sibling');
  assert.equal(sheet._getCharacterTraits()[0].effects, entry.effects);
  assert.equal(applyCatalogDescriptions({}, 'traits', [entry])[0].description, 'Original <text>');
  assert.equal(applyCatalogDescriptions(actor, 'talents', [entry])[0].description, 'Custom talent');

  action = 'restore';
  await editCatalogDescription(sheet, 'traits', entry.id);
  assert.deepEqual(writes.at(-1), {
    'flags.DBU-MRR-OLD.catalogDescriptions.traits.-=test_trait': null,
  });

  sheet.isEditable = false;
  await editCatalogDescription(sheet, 'traits', entry.id);
  assert.equal(writes.length, 2);
});

test('the editor saves a linked buff separately from an unchanged description', async () => {
  const entry = { id: 'test_talent', name: 'Test', description: 'Minha descrição\nSegunda linha' };
  const saved = [];
  const buff = { effect: 'Strike (All)', active: true, flat: 2, bT: 0, T: -1, trigger: 'lpBelow', triggerPercent: 50 };
  const row = {
    querySelector(selector) {
      const field = selector.match(/"([^"]+)"/)[1];
      return field === 'active' ? { checked: buff.active } : { value: String(buff[field]) };
    },
  };
  const actor = {
    system: { talents: [entry.id] },
    update: async changes => saved.push(changes),
  };
  const sheet = { actor, isEditable: true, _getCharacterTalents: () => [entry] };
  const previousWait = Dialog.wait;
  Dialog.wait = async options => {
    assert.match(options.content, /Adicionar Custom Buff/);
    return options.buttons.save.callback({
      0: { querySelectorAll: () => [row] },
      find: () => ({ val: () => entry.description }),
    });
  };
  try {
    await editCatalogDescription(sheet, 'talents', entry.id);
  } finally {
    Dialog.wait = previousWait;
  }
  assert.deepEqual(saved, [{ 'flags.DBU-MRR-OLD.catalogBuffs.talents.test_talent': [buff] }]);
});
