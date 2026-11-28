import test from 'node:test';
import assert from 'node:assert/strict';
import { hudTabsForActor, hudV2Panel, hudV2Tabs } from '../module/automation/scripts/hud-v2-menu.js';

test('the HUD rules tab shares only the current actor’s entries, edits and choices', () => {
  globalThis.CONFIG = { DBU: {
    racialTraitsCatalog: { shinjin: [{
      id: 'divine', name: 'Divine Magic', description: 'Resumo original', rulesVersion: '0.9.3',
      source: 'https://dbu-rpg.com/shinjin/', effects: [{ level: 3, activationType: 'option', keyword: 'Option',
        summary: 'Escolha um domínio.', options: [{ name: 'Peace', summary: 'Domínio escolhido.' }, { name: 'War', summary: 'Opção ausente.' }] }]
    }] },
    talentsCatalog: [{ id: 'alert', name: 'Alert', description: 'Bônus de iniciativa.' },
      { id: 'extra', name: 'Talento que não está na ficha', description: 'Este não aparece.' }]
  } };
  globalThis.foundry = { utils: { deepClone: structuredClone, escapeHTML: value => String(value) } };
  const system = { rulesVersion: '0.9.3', race: 'shinjin', racialTraits: ['divine'], talents: ['alert'],
    racialOptionSelections: { divine: { 3: 'Peace' } } };
  const actor = { name: 'Keiko', system, getFlag: (_, key) => key === 'catalogDescriptions'
    ? { traits: { divine: 'Descrição editada na ficha.' } } : undefined };

  assert.match(hudV2Tabs('rules', 0, hudTabsForActor(system)), /data-hud-tab="rules" aria-expanded="true"/);
  const panel = hudV2Panel({ tab: 'rules', actor });
  assert.match(panel, /Keiko/);
  assert.match(panel, /data-dbu-share-rule="Divine Magic"/);
  assert.match(panel, /data-dbu-share-rule="Alert"/);
  assert.match(panel, /Descrição editada na ficha\./);
  assert.match(panel, /Peace · Domínio escolhido\./);
  assert.match(panel, /data-dbu-share-source="https:\/\/dbu-rpg\.com\/shinjin\//);
  assert.doesNotMatch(panel, /Resumo original|Opção ausente|Talento que não está na ficha|data-dbu-hud-action="hud-run"/);
  assert.match(hudV2Panel({ tab: 'rules', actor: { name: 'Outro', system: {} } }), /Nenhuma entrada na ficha/);
});

test('clicking skip turn from the HUD advances exactly once while a click is pending', async () => {
  const { attachHudListeners } = await import('../module/automation/scripts/combat-hud.js');
  const gm = { id: 'gm', isGM: true, active: true };
  const actor = { id: 'a' };
  const current = { id: 'c', actor };
  let advances = 0, finish;
  globalThis.game = { user: gm, users: [gm], combat: {
    id: 'fight', round: 1, turn: 0, started: true, combatant: current, combatants: [current],
    nextTurn() { advances++; return new Promise(resolve => { finish = resolve; }); }
  } };
  let click;
  const button = { dataset: { dbuHudAction: 'skip-turn' }, isConnected: true,
    addEventListener(event, fn) { click = fn; } };
  attachHudListeners({ querySelectorAll: () => [button], querySelector: () => null }, actor, null);
  const event = { preventDefault() {}, stopPropagation() {} };
  const pending = click(event);
  await click(event);
  assert.equal(advances, 1);
  finish();
  await pending;
  assert.equal(button.disabled, false);
});
