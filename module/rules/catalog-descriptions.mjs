import { Dialog } from '../helpers/foundry-compat.mjs';

const SYSTEM = 'DBU-MRR-OLD';
const FLAG = 'catalogDescriptions';
const entryLists = { traits: 'racialTraits', talents: 'talents' };

export function applyCatalogDescriptions(actor, group, entries) {
  const descriptions = actor.getFlag?.(SYSTEM, FLAG)?.[group];
  return entries.map(entry => {
    const override = descriptions?.[entry.id];
    if (typeof override !== 'string') return entry;
    return { ...entry, description: override, customDescription: true };
  });
}

export async function editCatalogDescription(sheet, group, id) {
  const { actor } = sheet;
  const ownsEntry = () => sheet.isEditable && actor.system[entryLists[group]]?.includes(id);
  if (!Object.hasOwn(entryLists, group) || !/^[a-z0-9_-]+$/i.test(id || '') || !ownsEntry()) return;

  const entries = group === 'traits'
    ? sheet._getCharacterTraits(actor.system)
    : sheet._getCharacterTalents(actor.system);
  const entry = entries.find(candidate => candidate.id === id);
  if (!entry) return;

  const escape = foundry.utils.escapeHTML;
  const buttons = {
    save: { label: 'Salvar', callback: html => ({ description: html.find('textarea').val().trim() }) },
    cancel: { label: 'Cancelar', callback: () => null },
  };
  if (entry.customDescription) {
    buttons.restore = { label: 'Restaurar resumo do catálogo', callback: () => ({ restore: true }) };
  }

  const result = await Dialog.wait({
    title: 'Editar descrição',
    content: `<div class="dbu-catalog-description-editor">
      <label for="dbu-description-${id}"><strong>${escape(entry.name)}</strong></label>
      <p>Esta descrição fica salva neste personagem.</p>
      <textarea id="dbu-description-${id}" rows="8">${escape(entry.description || '')}</textarea>
    </div>`,
    buttons,
    default: 'save',
    close: () => null,
  }, { width: 560 });

  if (!result || !ownsEntry()) return;
  const path = `flags.${SYSTEM}.${FLAG}.${group}`;
  const changes = result.restore
    ? { [`${path}.-=${id}`]: null }
    : { [`${path}.${id}`]: result.description };
  await actor.update(changes);
}
