import { Dialog } from '../helpers/foundry-compat.mjs';
import { CATALOGS_093 } from './catalogs-v093.mjs';

export async function editAttackGrant093(actor, index, currentName = '') {
  const attack = actor.system.attackRefs?.[index];
  if (!attack) return;
  const definitions = CATALOGS_093.advantages;
  const options = Object.keys(definitions).sort((a, b) => a.localeCompare(b))
    .map(name => `<option value="${Handlebars.escapeExpression(name)}"${name === currentName ? ' selected' : ''}>${Handlebars.escapeExpression(name)}</option>`)
    .join('');
  const prior = attack.grantedAdvantages?.find(row => row.name === currentName);
  const result = await Dialog.wait({
    title: 'Vantagem concedida ao ataque',
    content: `<form>
      <div class="form-group"><label>Vantagem</label><select name="name"${prior ? ' disabled' : ''}>${options}</select></div>
      <div class="form-group"><label>Ranks</label><input name="ranks" type="number" min="1" value="${prior?.ranks || 1}"></div>
      <div class="form-group"><label>Fonte</label><input name="grantSource" value="${Handlebars.escapeExpression(prior?.grantSource || '')}"></div>
      <div class="form-group"><label>Opção ou anotação</label><input name="notes" value="${Handlebars.escapeExpression(prior?.notes || '')}"></div>
    </form>`,
    buttons: {
      save: { label: 'Salvar', callback: html => ({
        name: html.find('[name="name"]').val(),
        ranks: html.find('[name="ranks"]').val(),
        grantSource: html.find('[name="grantSource"]').val(),
        notes: html.find('[name="notes"]').val()
      }) },
      ...(prior ? { remove: { label: 'Remover', callback: () => ({ name: currentName, remove: true }) } } : {}),
      cancel: { label: 'Cancelar' }
    },
    default: 'save'
  });
  if (!result || !Object.hasOwn(definitions, result.name)) return;
  const refs = structuredClone(actor.system.attackRefs || []);
  const live = refs.find(row => row.id === attack.id);
  if (!live) return;
  const ranks = Math.max(1, Math.min(definitions[result.name].maxRanks, Math.trunc(Number(result.ranks)) || 1));
  const grants = (live.grantedAdvantages || []).filter(row => row.name !== result.name);
  if (!result.remove) grants.push({
    name: result.name, ranks, freeRanks: ranks, tpCost: 0,
    notes: result.notes, grantSource: result.grantSource
  });
  live.grantedAdvantages = grants;
  await actor.update({ 'system.attackRefs': refs });
}
