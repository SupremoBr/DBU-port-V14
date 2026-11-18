// Microbenchmark of catalog work only, not Foundry rendering or network latency.
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { ALL_RACIAL_TRAITS as catalog } from '../module/data/racial-traits-catalog.mjs';
import { getRacialCatalogIndex, getDisabledRacialPassives, getRacialStressBonus } from '../module/helpers/catalog-index.mjs';

const selected = Object.values(catalog).flat().slice(0, 24).map(t => t.id);
const index = getRacialCatalogIndex(catalog);
const enabled = Object.fromEntries([...index.toggleTraits.keys()].slice(0, 30).map(k => [k, false]));
function before() {
  const all = Object.values(catalog).flat();
  let stress = 0;
  for (const id of selected) for (const e of all.find(t => t.id === id)?.effects || []) {
    const text = (e.text || '').toLowerCase();
    if (e.activationType === 'passive' && (text.includes('increase your stress bonus by 1') || text.includes('increase stress bonus by 1'))) stress++;
  }
  const disabled = new Set();
  for (const list of Object.values(catalog)) for (const trait of list) {
    const key = trait.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    for (const e of trait.effects || []) {
      if (!['passive', 'option', 'multi-option', 'choice'].includes(e.activationType || 'passive')) continue;
      if (enabled[`racial_${trait.traitCategory || 'secondary'}_${key}_${e.level}`] === false) { disabled.add(trait.id); break; }
    }
  }
  return stress + disabled.size;
}
function after() {
  return getRacialStressBonus(catalog, selected) + getDisabledRacialPassives(catalog, enabled).size;
}
assert.equal(before(), after());
for (let i = 0; i < 200; i++) { before(); after(); }
function measure(fn) {
  const samples = [];
  let checksum = 0;
  for (let sample = 0; sample < 5; sample++) {
    const start = performance.now();
    for (let i = 0; i < 2000; i++) checksum += fn();
    samples.push(performance.now() - start);
  }
  return { medianMs: +samples.sort((a, b) => a - b)[2].toFixed(2), checksum };
}
const old = measure(before), optimized = measure(after);
assert.equal(old.checksum, optimized.checksum);
console.log(JSON.stringify({ scope: 'Stress and disabled-passive catalog lookups only; warm indexes', node: process.version, iterationsPerSample: 2000, samples: 5, before: old, after: optimized }, null, 2));
