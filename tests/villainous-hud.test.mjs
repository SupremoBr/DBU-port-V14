import test from 'node:test';
import assert from 'node:assert/strict';
import { hudTabsForActor, hudV2Panel, hudV2Tabs, hudV2Action } from '../module/automation/scripts/hud-v2-menu.js';

test('current adversaries get nine read-only maneuver cards in the combat HUD', () => {
  const standard = { rulesVersion: '0.9.3', adversary: { enabled: true, category: 'standard' } };
  assert.match(hudV2Tabs('villain', 0, hudTabsForActor(standard)), /data-hud-tab="villain" aria-expanded="true"/);
  assert.doesNotMatch(hudV2Tabs(null, 0, hudTabsForActor({ ...standard, adversary: { enabled: false } })), /data-hud-tab="villain"/);
  assert.doesNotMatch(hudV2Tabs(null, 0, hudTabsForActor({ ...standard, adversary: { enabled: true, category: 'mook' } })), /data-hud-tab="villain"/);
  assert.equal(hudV2Panel({ tab: 'villain' }), '');
  const render = hudV2Panel({ tab: 'villain', selected: 'act-again', showVillain: true });
  assert.equal((render.match(/data-dbu-hud-action="hud-select"/g) || []).length, 9);
  assert.match(render, /Quando outro personagem termina o turno/);
  assert.doesNotMatch(render, /data-dbu-hud-action="hud-(run|favorite)"/);
  assert.equal(hudV2Action('act-again'), null);
});
