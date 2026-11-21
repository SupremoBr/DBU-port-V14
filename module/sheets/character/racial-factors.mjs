import { Dialog } from '../../helpers/foundry-compat.mjs';
import { RACES_093 } from '../../rules/races-v093.mjs';

const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function racialFactorsForRace(catalog, raceId) {
  const race = normalize(RACES_093[raceId]?.name || raceId);
  return Object.values(catalog).flat().filter(({ factor }) => {
    if (!factor || (factor.traitRace && normalize(factor.traitRace) !== race)) return false;
    const any = /^Any\b/i.test(factor.raceRequirement);
    const list = factor.raceRequirement.replace(/^Any\s*\(Except\s*/i, '').replace(/\)$/, '');
    const matches = list.split(/,|\bor\b/i).some(name => normalize(name) === race);
    return any ? !matches : matches;
  }).sort((a, b) => a.factor.name.localeCompare(b.factor.name) || a.name.localeCompare(b.name));
}

export function openRacialFactorSelector(actor, catalog) {
  const source = () => actor._source?.system ?? actor.system;
  const initial = source();
  const rows = racialFactorsForRace(catalog, initial.race);
  const escape = value => Handlebars.escapeExpression(String(value ?? ''));
  const replacementFor = factor => factor.replaces || (factor.replacementCategory === 'mind'
    ? 'um traço secundário de Mind' : 'um traço secundário');
  const buildList = (search = '') => {
    const selected = new Set(source().racialTraits || []);
    const matches = rows.filter(row => normalize(row.name + row.factor.name).includes(normalize(search)));
    if (!matches.length) return '<p>Nenhum fator encontrado.</p>';
    return [false, true].map(general => {
      const group = matches.filter(({ factor }) => (/^Any\b/i.test(factor.raceRequirement) && !factor.traitRace) === general);
      if (!group.length) return '';
      return `<h3>${general ? 'Fatores gerais' : 'Fatores da sua raça'}</h3>
        ${group.map(({ id, name, factor, source: url }) => {
          const added = selected.has(id);
          return `<div class="dbu-factor-entry">
            <div>
              <strong class="trait-selector-name">${escape(name)}</strong>
              <span>· ${escape(factor.name)}</span>
              <p>Troca ${escape(replacementFor(factor))}. Limite do fator: ${factor.limit}.</p>
              ${factor.prerequisites ? `<p>Pré-requisito: ${escape(factor.prerequisites)}</p>` : ''}
              <a href="${escape(url)}" target="_blank" rel="noopener noreferrer">Regra oficial</a>
            </div>
            <button type="button" class="dbu-factor-add" data-trait-id="${escape(id)}" ${added ? 'disabled' : ''}
              aria-label="${added ? 'Já na ficha' : 'Adicionar'} ${escape(name)}">${added ? 'Na ficha' : 'Adicionar'}</button>
          </div>`;
        }).join('')}`;
    }).join('');
  };

  new Dialog({
    title: `Racial Factors — ${RACES_093[initial.race]?.name || initial.race || ''}`,
    content: `<div class="trait-selector-modal">
      <p>Adicione o Factor Trait e remova manualmente o traço que ele substitui. Confira os pré-requisitos com o ARC.</p>
      <label class="trait-selector-filters">Buscar <input type="search" class="dbu-factor-search" placeholder="Nome do fator ou traço"></label>
      <div class="trait-selector-list">${buildList()}</div>
    </div>`,
    buttons: { close: { label: 'Fechar' } },
    default: 'close',
    render: html => {
      const search = html.find('.dbu-factor-search');
      const refresh = () => html.find('.trait-selector-list').html(buildList(search.val()));
      search.on('input', refresh);
      let adding = false;
      html.on('click', '.dbu-factor-add', async event => {
        if (adding) return;
        const id = event.currentTarget.dataset.traitId;
        const current = source();
        const traits = current.racialTraits || [];
        if (current.race !== initial.race || traits.includes(id) || !rows.some(row => row.id === id)) return;
        adding = true;
        try {
          await actor.update({ 'system.racialTraits': [...traits, id] });
          refresh();
        } finally {
          adding = false;
        }
      });
    },
  }, { width: 620, classes: ['dbu-old', 'trait-selector-dialog', 'dbu-factor-dialog'] }).render(true);
}
