import {
  buffStateLabels, buffTriggers, customBuffState, manualBuffEffect, supportsBuffTrigger,
} from '../../helpers/custom-buffs.mjs';

const emptyBuff = { active: true, effect: '', flat: 0, bT: 0, T: 0, trigger: 'always', triggerPercent: 50 };

function buffRow(buff, system, options, escape) {
  const renderOptions = (choices, selected) => Object.entries(choices).map(([value, label]) =>
    `<option value="${escape(value)}"${value === selected ? ' selected' : ''}>${escape(label)}</option>`
  ).join('');
  const existing = buff.effect && !options.includes(buff.effect) ? [buff.effect] : [];
  const effects = ['', ...options, ...existing];
  const effectOptions = renderOptions(Object.fromEntries(effects.map(value => [value, value || 'Escolha um efeito'])), buff.effect);
  const trigger = buff.trigger || 'always';
  const triggers = renderOptions(buffTriggers, trigger);
  const numbers = [['flat', 'Flat'], ['bT', '×bT'], ['T', '×T']].map(([key, label]) =>
    `<label>${label}<input type="number" step="1" data-buff-field="${key}" value="${Number(buff[key]) || 0}"></label>`
  ).join('');
  return `<fieldset data-catalog-buff>
    <legend>Custom Buff</legend>
    <div class="dbu-catalog-buff-fields">
      <label><input type="checkbox" data-buff-field="active"${buff.active ? ' checked' : ''}> Habilitado</label>
      <label>Efeito<select data-buff-field="effect">${effectOptions}</select></label>
      ${numbers}
      <label>Ativar<select data-buff-field="trigger">${triggers}</select></label>
      <label data-lp-percent${trigger === 'lpBelow' ? '' : ' hidden'}>Porcentagem de LP
        <input type="number" step="1" min="0" max="100" data-buff-field="triggerPercent" value="${Number(buff.triggerPercent ?? 50)}">
      </label>
      <span data-buff-state>${buffStateLabels[customBuffState(buff, system)]}</span>
      <button type="button" data-remove-catalog-buff>Remover buff</button>
    </div>
  </fieldset>`;
}

function readBuffRow(row) {
  const input = key => row.querySelector(`[data-buff-field="${key}"]`);
  const int = key => Math.trunc(Number(input(key).value) || 0);
  return {
    active: input('active').checked,
    effect: input('effect').value,
    flat: int('flat'), bT: int('bT'), T: int('T'),
    trigger: input('trigger').value || 'always',
    triggerPercent: input('triggerPercent').value === '' ? 50 : Math.max(0, Math.min(100, int('triggerPercent'))),
  };
}

export function createCatalogBuffEditor(actor, buffs, escape) {
  const options = (globalThis.CONFIG?.DBU?.customBuffOptions || []).filter(effect => !manualBuffEffect(effect));
  const rowHtml = buff => buffRow(buff, actor.system, options, escape);
  return {
    content: `<div class="dbu-catalog-buff-editor">
      <p>Os buffs ficam neste personagem e são somados aos efeitos da ficha.</p>
      <div data-catalog-buff-list>${buffs.map(rowHtml).join('')}</div>
      <button type="button" data-add-catalog-buff>Adicionar Custom Buff</button>
    </div>`,
    read(html) {
      const rows = html[0]?.querySelectorAll('[data-catalog-buff]') || [];
      return Array.from(rows, readBuffRow).filter(buff => buff.effect);
    },
    bind(html) {
      function updateRow(row) {
        const buff = readBuffRow(row);
        row.querySelector('[data-lp-percent]').hidden = buff.trigger !== 'lpBelow';
        row.querySelector('[data-buff-state]').textContent = buffStateLabels[customBuffState(buff, actor.system)];
        for (const option of row.querySelector('[data-buff-field="effect"]').options) {
          option.disabled = buff.trigger !== 'always' && !!option.value && !supportsBuffTrigger(option.value);
        }
      }
      html.on('click', '[data-add-catalog-buff]', () => {
        html.find('[data-catalog-buff-list]').append(rowHtml(emptyBuff));
      });
      html.on('click', '[data-remove-catalog-buff]', event => event.currentTarget.closest('[data-catalog-buff]').remove());
      html.on('change', '[data-buff-field]', event => updateRow(event.currentTarget.closest('[data-catalog-buff]')));
      html[0].querySelectorAll('[data-catalog-buff]').forEach(updateRow);
    },
  };
}
