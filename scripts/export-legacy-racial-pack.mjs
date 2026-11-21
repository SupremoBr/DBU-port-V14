// Export the bundled 0.9.2 reference for `fvtt package pack racial-traits`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_RACIAL_TRAITS } from '../module/data/racial-traits-catalog.mjs';

const [output] = process.argv.slice(2);
if (!output) throw new Error('Usage: node scripts/export-legacy-racial-pack.mjs <empty output directory>');
mkdirSync(output, { recursive: true });

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

for (const entry of Object.values(ALL_RACIAL_TRAITS).flat()) {
  const effects = entry.effects.map(({ level, activationType, keyword, text, usageLimit, maxUses }) => ({
    level, activationType, keyword, text, usageLimit: usageLimit || '', maxUses: maxUses ?? 0,
  }));
  const details = effects.map(effect =>
    `<p><strong>Lv.${effect.level} [${escape(effect.keyword)}]</strong> ${escape(effect.text)}</p>`
  ).join('');
  const doc = {
    _id: entry.id,
    _key: `!items!${entry.id}`,
    name: entry.name,
    type: 'racialTrait',
    img: 'icons/svg/book.svg',
    system: {
      race: entry.race,
      category: entry.category,
      traitCategory: entry.traitCategory,
      description: `<p><strong>Referência legada 0.9.2</strong> · ${escape(entry.race)}</p><p>${escape(entry.description)}</p>${details}`,
      effects,
    },
  };
  writeFileSync(join(output, entry.id + '.json'), JSON.stringify(doc) + '\n', { flag: 'wx' });
}
