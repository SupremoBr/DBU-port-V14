import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleShareButton, shareRuleToChat } from '../module/helpers/rule-share.mjs';

test('sharing sends only the selected rule to public chat and escapes user text', async t => {
  const messages = [];
  t.mock.method(console, 'error', () => {});
  globalThis.foundry = { utils: { escapeHTML: value => String(value).replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) } };
  globalThis.ChatMessage = {
    getSpeaker: ({ actor }) => ({ actor: actor.id }),
    async create(message) { messages.push(message); }
  };
  const scope = {
    dataset: { dbuShareSource: 'https://dbu-rpg.com/foundations-profiles/' },
    querySelectorAll: () => [edited, effect, other]
  };
  const edited = { value: '<em>Descrição editada</em>', matches: () => true, closest: () => scope };
  const effect = { textContent: 'Lv.1\n    [Passive] +1 Strike', matches: () => false, closest: () => scope };
  const other = { textContent: 'Texto de outra entrada', matches: () => false, closest: () => ({}) };
  const button = { dataset: { dbuShareRule: 'Teste "1"' }, closest: () => scope, disabled: false };

  assert.match(ruleShareButton('Teste "1"'), /aria-label="Enviar Teste &quot;1&quot; ao chat"/);
  await Promise.all([shareRuleToChat(button, { id: 'actor' }), shareRuleToChat(button, { id: 'actor' })]);
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].whisper, []);
  assert.equal(messages[0].blind, false);
  assert.deepEqual(messages[0].speaker, { actor: 'actor' });
  assert.match(messages[0].content, /&lt;em&gt;Descrição editada/);
  assert.match(messages[0].content, /Lv\.1 \[Passive\] \+1 Strike/);
  assert.match(messages[0].content, /href="https:\/\/dbu-rpg\.com/);
  assert.doesNotMatch(messages[0].content, /Texto de outra entrada|<em>/);
  assert.equal(button.disabled, false);

  scope.dataset.dbuShareSource = 'javascript:alert(1)';
  await shareRuleToChat(button, { id: 'actor' });
  assert.doesNotMatch(messages[1].content, /javascript:|href=/);
});
