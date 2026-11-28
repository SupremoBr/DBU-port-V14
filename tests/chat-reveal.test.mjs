import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeRevealCore } from '../module/automation/scripts/combat/reveal-core.js';

test('chat renders published totals over stale waiting markup only after reveal', () => {
  const hooks = {};
  globalThis.game = { version: '13' };
  globalThis.DBU_BOOTSTRAP = {};
  globalThis.Hooks = { on: (name, callback) => { hooks[name] = callback; } };
  globalThis.document = { addEventListener() {}, createElement: () => ({ querySelector: () => null }) };
  globalThis.HTMLElement = class {};
  globalThis.$ = node => [node];
  initializeRevealCore({ DBU_SYSTEM_ID: 'DBU-MRR-OLD', dbuEsc: String });
  const results = { innerHTML: '?', querySelectorAll: () => [{ textContent: '?' }] };
  const waiting = { textContent: 'Aguardando', classList: { remove() {} } };
  const root = new HTMLElement();
  root.querySelector = selector => selector.includes('secret-attack-results') ? results
    : selector.includes('target-row') ? waiting : null;
  const flags = { dbuCombatRevealed: false, dbuAttackData: { strikeTotal: 16, woundTotal: 12 },
    dbuDefenseStates: { target: { finalized: true, text: 'Dodge 18 · Sucesso' } } };
  const message = { getFlag: (_, key) => flags[key] };
  hooks.renderChatMessageHTML(message, root);
  assert.equal(results.innerHTML, '?');
  assert.equal(waiting.textContent, 'Aguardando');
  flags.dbuCombatRevealed = true;
  hooks.renderChatMessageHTML(message, root);
  assert.match(results.innerHTML, />16<\/span>/);
  assert.match(results.innerHTML, />12<\/span>/);
  assert.equal(waiting.textContent, 'Dodge 18 · Sucesso');
});
